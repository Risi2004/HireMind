const https = require('https');
const User = require('../models/User');
const { uploadResume, getPrivateResumeStream, deleteResume } = require('../services/cloudflareR2');

/**
 * Helper to fetch public GitHub profile via Node https module (no external fetch dependency)
 *
 * @param {string} username
 * @returns {Promise<any>}
 */
const fetchGithubProfile = (username) => {
  return new Promise((resolve, reject) => {
    const cleanUsername = username.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').trim();
    if (!cleanUsername) {
      return reject(new Error('Invalid GitHub username'));
    }

    const options = {
      hostname: 'api.github.com',
      path: `/users/${encodeURIComponent(cleanUsername)}`,
      method: 'GET',
      headers: {
        'User-Agent': 'HireMind-App-Agent',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 404) {
          return reject(new Error(`GitHub profile "${cleanUsername}" was not found.`));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API returned status ${res.statusCode}`));
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
    req.end();
  });
};

/**
 * @desc    Connect candidate GitHub account
 * @route   POST /api/profile/github/connect
 * @access  Private
 */
const connectGithub = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'GitHub username or profile URL is required' });
    }

    const ghData = await fetchGithubProfile(username);
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.github = {
      connected: true,
      username: ghData.login,
      profileUrl: ghData.html_url,
      avatarUrl: ghData.avatar_url || '',
      name: ghData.name || ghData.login,
      publicRepos: ghData.public_repos || 0,
      connectedAt: new Date(),
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully connected GitHub account: @${ghData.login}`,
      github: user.github,
      user,
    });
  } catch (error) {
    console.error('[GitHub Connect Error]:', error.message);
    return res.status(400).json({ message: error.message || 'Failed to connect GitHub account' });
  }
};

/**
 * @desc    Disconnect candidate GitHub account
 * @route   POST /api/profile/github/disconnect
 * @access  Private
 */
const disconnectGithub = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.github = {
      connected: false,
      username: '',
      profileUrl: '',
      avatarUrl: '',
      name: '',
      publicRepos: 0,
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'GitHub account disconnected successfully',
      github: user.github,
      user,
    });
  } catch (error) {
    console.error('[GitHub Disconnect Error]:', error.message);
    return res.status(500).json({ message: error.message || 'Failed to disconnect GitHub account' });
  }
};

/**
 * @desc    Complete profile setup flow (Uploads CV to Cloudflare R2, saves career details)
 * @route   POST /api/profile/setup
 * @access  Private
 */
const completeProfileSetup = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      field,
      customField,
      experienceLevel,
      careerStage,
      customCareerStage,
      githubUsername,
    } = req.body;

    // Handle CV / Resume file upload to Cloudflare R2 if provided
    if (req.file) {
      const allowedExts = ['.pdf', '.doc', '.docx'];
      const fileExt = req.file.originalname.toLowerCase().match(/\.[0-9a-z]+$/)?.[0];

      if (!fileExt || !allowedExts.includes(fileExt)) {
        return res.status(400).json({ message: 'Please upload a valid resume in PDF or DOCX format.' });
      }

      // If user previously had a resume, delete old one from storage
      if (user.resumeUrl) {
        await deleteResume(user.resumeUrl);
      }

      const uploaded = await uploadResume(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      user.resumeUrl = uploaded.resumeUrl;
      user.resumeFileName = uploaded.originalFilename;
    }

    // Set Field & Career Stage
    const resolvedField = field === 'Other' && customField?.trim() ? customField.trim() : field;
    const resolvedCareerStage = careerStage === 'Other' && customCareerStage?.trim() ? customCareerStage.trim() : careerStage;

    if (resolvedField) user.field = resolvedField;
    if (resolvedCareerStage) user.careerStage = resolvedCareerStage;
    if (experienceLevel) user.experienceLevel = experienceLevel;

    // Connect GitHub if passed and not yet connected
    if (githubUsername && (!user.github || !user.github.connected)) {
      try {
        const ghData = await fetchGithubProfile(githubUsername);
        user.github = {
          connected: true,
          username: ghData.login,
          profileUrl: ghData.html_url,
          avatarUrl: ghData.avatar_url || '',
          name: ghData.name || ghData.login,
          publicRepos: ghData.public_repos || 0,
          connectedAt: new Date(),
        };
      } catch (ghErr) {
        console.warn('[Profile Setup] GitHub auto-connect failed:', ghErr.message);
      }
    }

    // Mark profile setup completed!
    user.isProfileSetupCompleted = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile setup completed successfully!',
      user,
    });
  } catch (error) {
    console.error('[Profile Setup Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error completing profile setup' });
  }
};

/**
 * @desc    Stream private resume directly from Cloudflare R2
 * @route   GET /api/profile/resume/:filename
 * @access  Private
 */
const getResume = async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ message: 'Invalid resume file request' });
    }

    const { Body, ContentType } = await getPrivateResumeStream(`resumes/${filename}`);

    res.setHeader('Content-Type', ContentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    Body.pipe(res);
  } catch (error) {
    console.error('[Resume Stream Error]:', error.message);
    return res.status(404).json({ message: 'Resume document not found' });
  }
};

module.exports = {
  connectGithub,
  disconnectGithub,
  completeProfileSetup,
  getResume,
};
