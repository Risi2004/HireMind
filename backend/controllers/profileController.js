const https = require('https');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  uploadResume,
  getPrivateResumeStream,
  deleteResume,
  uploadProfilePicture,
  deleteAvatar,
} = require('../services/cloudflareR2');

/**
 * Universal GitHub HTTPS API Request Helper
 *
 * @param {object} options - Node https options
 * @param {object|string|null} postData - Optional request body
 * @returns {Promise<any>}
 */
const makeGithubRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'HireMind-App-Agent',
      'Accept': 'application/vnd.github.v3+json',
    };

    const mergedOptions = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {}),
      },
    };

    const req = https.request(mergedOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          try {
            const errJson = JSON.parse(data);
            return reject(new Error(errJson.message || `GitHub API error: HTTP ${res.statusCode}`));
          } catch (e) {
            return reject(new Error(`GitHub API error: HTTP ${res.statusCode}`));
          }
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

/**
 * Helper to fetch public GitHub profile via Node https module
 *
 * @param {string} username
 * @returns {Promise<any>}
 */
const fetchGithubProfile = async (username) => {
  const cleanUsername = username.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').trim();
  if (!cleanUsername) {
    throw new Error('Invalid GitHub username');
  }

  return makeGithubRequest({
    hostname: 'api.github.com',
    path: `/users/${encodeURIComponent(cleanUsername)}`,
    method: 'GET',
  });
};

/**
 * Helper to fetch public repositories for a username
 *
 * @param {string} username
 * @returns {Promise<any[]>}
 */
const fetchGithubUserRepos = async (username) => {
  const cleanUsername = username.replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '').trim();
  try {
    const repos = await makeGithubRequest({
      hostname: 'api.github.com',
      path: `/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=30`,
      method: 'GET',
    });
    return Array.isArray(repos) ? repos : [];
  } catch (err) {
    console.warn(`[GitHub Repos] Could not fetch repos for ${cleanUsername}:`, err.message);
    return [];
  }
};

/**
 * Map raw GitHub repo objects to clean model format
 */
const mapGithubRepos = (repos) => {
  if (!Array.isArray(repos)) return [];
  return repos.slice(0, 30).map((r) => ({
    name: r.name,
    fullName: r.full_name,
    description: r.description || '',
    url: r.html_url,
    language: r.language || '',
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    isPrivate: !!r.private,
    defaultBranch: r.default_branch || 'main',
    updatedAt: r.updated_at ? new Date(r.updated_at) : null,
  }));
};

/**
 * @desc    Initiate GitHub OAuth 2.0 Authorization Flow
 * @route   GET /api/profile/github/auth
 * @access  Public (Validated via JWT query param or Header)
 */
const githubAuthRedirect = async (req, res) => {
  try {
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectParam = req.query.redirect || '/profile-setup';

    // Verify user identity through query token or authorization header
    let token = req.query.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace(/^Bearer\s+/i, '');
    }

    if (!token) {
      return res.redirect(`${clientUrl}/login?error=auth_required`);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key');
    } catch (jwtErr) {
      return res.redirect(`${clientUrl}/login?error=invalid_token`);
    }

    if (!clientId) {
      console.warn('[GitHub OAuth] GITHUB_CLIENT_ID not configured in backend/.env');
      return res.redirect(`${clientUrl}${redirectParam}?github_error=oauth_not_configured`);
    }

    const backendBase = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${backendBase}/api/profile/github/callback`;

    // Secure state parameter containing userId and return destination
    const statePayload = JSON.stringify({ userId: decoded.id, redirect: redirectParam });
    const state = Buffer.from(statePayload).toString('base64url');

    // Scope: read:user (profile info) and repo (allows reading repos and code/README for interview analysis)
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&scope=read:user,repo&state=${state}`;

    return res.redirect(githubAuthUrl);
  } catch (error) {
    console.error('[GitHub Auth Error]:', error);
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return res.redirect(`${clientUrl}/profile-setup?github_error=failed_to_start_oauth`);
  }
};

/**
 * @desc    GitHub OAuth Callback (Exchanges code for access token & syncs repos)
 * @route   GET /api/profile/github/callback
 * @access  Public
 */
const githubCallback = async (req, res) => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const { code, state, error: ghError } = req.query;

  let redirectPath = '/profile-setup';
  let userId = null;

  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (decodedState.userId) userId = decodedState.userId;
      if (decodedState.redirect) redirectPath = decodedState.redirect;
    } catch (e) {
      console.warn('[GitHub OAuth] Could not parse state:', e.message);
    }
  }

  if (ghError || !code) {
    console.warn('[GitHub OAuth] User canceled or access denied:', ghError);
    return res.redirect(`${clientUrl}${redirectPath}?github_error=access_denied`);
  }

  if (!userId) {
    return res.redirect(`${clientUrl}${redirectPath}?github_error=session_expired`);
  }

  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const backendBase = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${backendBase}/api/profile/github/callback`;

    if (!clientId || !clientSecret) {
      return res.redirect(`${clientUrl}${redirectPath}?github_error=credentials_missing`);
    }

    // 1. Exchange authorization code for GitHub access token
    const tokenResponse = await makeGithubRequest(
      {
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      },
      {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }
    );

    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
      console.error('[GitHub OAuth] No access token received:', tokenResponse);
      return res.redirect(`${clientUrl}${redirectPath}?github_error=token_exchange_failed`);
    }

    // 2. Fetch authenticated GitHub user details
    const ghUser = await makeGithubRequest({
      hostname: 'api.github.com',
      path: '/user',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // 3. Fetch candidate's repositories
    let rawRepos = [];
    try {
      rawRepos = await makeGithubRequest({
        hostname: 'api.github.com',
        path: '/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator',
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (repoErr) {
      console.warn('[GitHub OAuth] Failed to fetch repos:', repoErr.message);
    }

    const mappedRepos = mapGithubRepos(rawRepos);

    // 4. Persist to MongoDB User document
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect(`${clientUrl}/login?error=user_not_found`);
    }

    user.github = {
      connected: true,
      username: ghUser.login,
      profileUrl: ghUser.html_url,
      avatarUrl: ghUser.avatar_url || '',
      name: ghUser.name || ghUser.login,
      publicRepos: ghUser.public_repos || mappedRepos.length,
      accessToken: accessToken,
      repos: mappedRepos,
      connectedAt: new Date(),
    };

    await user.save();
    console.log(`[GitHub OAuth] Successfully connected @${ghUser.login} with ${mappedRepos.length} repos for user ${user._id}`);

    return res.redirect(`${clientUrl}${redirectPath}?github_connected=true`);
  } catch (error) {
    console.error('[GitHub Callback Error]:', error.message);
    return res.redirect(`${clientUrl}${redirectPath}?github_error=auth_failed`);
  }
};

/**
 * @desc    Connect candidate GitHub account (Username lookup fallback)
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

    // Also fetch public repositories for code inspection
    const rawRepos = await fetchGithubUserRepos(username);
    const mappedRepos = mapGithubRepos(rawRepos);

    user.github = {
      connected: true,
      username: ghData.login,
      profileUrl: ghData.html_url,
      avatarUrl: ghData.avatar_url || '',
      name: ghData.name || ghData.login,
      publicRepos: ghData.public_repos || mappedRepos.length,
      repos: mappedRepos,
      connectedAt: new Date(),
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully connected GitHub account: @${ghData.login} (${mappedRepos.length} repos synced)`,
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
      accessToken: '',
      repos: [],
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
 * @desc    Get candidate's synced GitHub repositories
 * @route   GET /api/profile/github/repos
 * @access  Private
 */
const getGithubRepos = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+github.accessToken');
    if (!user || !user.github?.connected) {
      return res.status(404).json({ message: 'GitHub account is not connected.' });
    }

    return res.status(200).json({
      success: true,
      username: user.github.username,
      repos: user.github.repos || [],
      connected: user.github.connected,
    });
  } catch (error) {
    console.error('[Get GitHub Repos Error]:', error.message);
    return res.status(500).json({ message: 'Failed to retrieve GitHub repositories' });
  }
};

/**
 * @desc    Inspect a specific GitHub repository's README for AI interview analysis
 * @route   GET /api/profile/github/repo/:owner/:repo/readme
 * @access  Private
 */
const getGithubRepoReadme = async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const user = await User.findById(req.user._id).select('+github.accessToken');

    if (!user || !user.github?.connected) {
      return res.status(404).json({ message: 'GitHub account is not connected' });
    }

    const headers = {};
    if (user.github.accessToken) {
      headers.Authorization = `Bearer ${user.github.accessToken}`;
    }

    const readmeObj = await makeGithubRequest({
      hostname: 'api.github.com',
      path: `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
      method: 'GET',
      headers,
    });

    let readmeText = '';
    if (readmeObj && readmeObj.content) {
      readmeText = Buffer.from(readmeObj.content, 'base64').toString('utf8');
    }

    return res.status(200).json({
      success: true,
      owner,
      repo,
      readme: readmeText,
    });
  } catch (error) {
    console.error('[GitHub Repo README Error]:', error.message);
    return res.status(404).json({ message: 'README not found or inaccessible for this repository' });
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
      skills,
      careerInterests,
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

    // Process and save candidate skills
    if (skills) {
      let parsedSkills = [];
      if (Array.isArray(skills)) {
        parsedSkills = skills;
      } else if (typeof skills === 'string' && skills.trim()) {
        try {
          const parsed = JSON.parse(skills);
          if (Array.isArray(parsed)) parsedSkills = parsed;
          else parsedSkills = skills.split(',').map((s) => s.trim()).filter(Boolean);
        } catch {
          parsedSkills = skills.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      user.skills = parsedSkills.map((s) => String(s).trim()).filter(Boolean);
    }

    // Process and save candidate career interests
    if (careerInterests) {
      let parsedInterests = [];
      if (Array.isArray(careerInterests)) {
        parsedInterests = careerInterests;
      } else if (typeof careerInterests === 'string' && careerInterests.trim()) {
        try {
          const parsed = JSON.parse(careerInterests);
          if (Array.isArray(parsed)) parsedInterests = parsed;
          else parsedInterests = careerInterests.split(',').map((s) => s.trim()).filter(Boolean);
        } catch {
          parsedInterests = careerInterests.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }
      user.careerInterests = parsedInterests.map((s) => String(s).trim()).filter(Boolean);
    }

    // Connect GitHub if passed and not yet connected
    if (githubUsername && (!user.github || !user.github.connected)) {
      try {
        const ghData = await fetchGithubProfile(githubUsername);
        const rawRepos = await fetchGithubUserRepos(githubUsername);
        const mappedRepos = mapGithubRepos(rawRepos);

        user.github = {
          connected: true,
          username: ghData.login,
          profileUrl: ghData.html_url,
          avatarUrl: ghData.avatar_url || '',
          name: ghData.name || ghData.login,
          publicRepos: ghData.public_repos || mappedRepos.length,
          repos: mappedRepos,
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

    let targetKey = filename;
    let displayName = req.user?.resumeFileName || filename;

    // Resolve human-readable name or generic 'view' parameter to actual cloud object key
    if (
      (!targetKey.startsWith('resume-') || targetKey === req.user?.resumeFileName || targetKey === 'view') &&
      req.user?.resumeUrl
    ) {
      const parts = req.user.resumeUrl.split('/api/profile/resume/');
      if (parts[1]) {
        targetKey = parts[1];
      }
    }

    const { Body, ContentType } = await getPrivateResumeStream(`resumes/${targetKey}`);

    res.setHeader('Content-Type', ContentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(displayName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    Body.pipe(res);
  } catch (error) {
    console.error('[Resume Stream Error]:', error.message);
    return res.status(404).json({ message: 'Resume document not found' });
  }
};

/**
 * @desc    Get complete candidate profile details from database
 * @route   GET /api/profile/me
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('[Get Profile Error]:', error);
    return res.status(500).json({ message: 'Failed to retrieve profile data' });
  }
};

/**
 * @desc    Update general candidate profile fields in database
 * @route   PUT /api/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const {
      firstName,
      lastName,
      title,
      careerStage,
      field,
      experienceLevel,
      careerInterests,
      skills,
      bio,
      tier,
      linkedin,
    } = req.body;

    if (firstName !== undefined && firstName.trim()) user.firstName = firstName.trim();
    if (lastName !== undefined && lastName.trim()) user.lastName = lastName.trim();
    if (title !== undefined) user.title = String(title).trim();
    if (careerStage !== undefined) user.careerStage = String(careerStage).trim();
    if (field !== undefined) user.field = String(field).trim();
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel;
    if (bio !== undefined) user.bio = String(bio).trim();
    if (tier !== undefined) user.tier = tier;

    if (careerInterests !== undefined && Array.isArray(careerInterests)) {
      user.careerInterests = careerInterests.map((i) => String(i).trim()).filter(Boolean);
    }

    if (skills !== undefined && Array.isArray(skills)) {
      user.skills = skills.map((s) => String(s).trim()).filter(Boolean);
    }

    if (linkedin !== undefined && typeof linkedin === 'object') {
      user.linkedin = {
        connected: linkedin.connected !== undefined ? Boolean(linkedin.connected) : user.linkedin?.connected,
        username: linkedin.username !== undefined ? String(linkedin.username).trim() : (user.linkedin?.username || ''),
        profileUrl: linkedin.profileUrl !== undefined ? String(linkedin.profileUrl).trim() : (user.linkedin?.profileUrl || ''),
        name: linkedin.name !== undefined ? String(linkedin.name).trim() : (user.linkedin?.name || ''),
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    console.error('[Update Profile Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
};

/**
 * @desc    Upload or replace candidate resume in Cloudflare R2 and update database
 * @route   POST /api/profile/resume
 * @access  Private
 */
const uploadResumeFile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please provide a valid resume file (.pdf, .doc, .docx)' });
    }

    const allowedExts = ['.pdf', '.doc', '.docx'];
    const fileExt = req.file.originalname.toLowerCase().match(/\.[0-9a-z]+$/)?.[0];

    if (!fileExt || !allowedExts.includes(fileExt)) {
      return res.status(400).json({ message: 'Only .pdf, .doc, and .docx resumes are supported' });
    }

    // Purge previous resume from private Cloudflare R2 if it exists
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
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Resume "${uploaded.originalFilename}" uploaded successfully!`,
      resumeUrl: uploaded.resumeUrl,
      resumeFileName: uploaded.originalFilename,
      user,
    });
  } catch (error) {
    console.error('[Upload Resume Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to upload resume document' });
  }
};

/**
 * @desc    Delete candidate resume from Cloudflare R2 and database
 * @route   DELETE /api/profile/resume
 * @access  Private
 */
const deleteResumeFile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.resumeUrl) {
      await deleteResume(user.resumeUrl);
    }

    user.resumeUrl = '';
    user.resumeFileName = '';
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Resume removed successfully',
      user,
    });
  } catch (error) {
    console.error('[Delete Resume Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to remove resume document' });
  }
};

/**
 * @desc    Upload or change candidate avatar picture
 * @route   POST /api/profile/avatar
 * @access  Private
 */
const uploadAvatarFile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file (JPG, JPEG, PNG under 5MB)' });
    }

    // Purge old avatar if any
    if (user.avatarUrl) {
      await deleteAvatar(user.avatarUrl);
    }

    const newAvatarUrl = await uploadProfilePicture(req.file);
    user.avatarUrl = newAvatarUrl;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully!',
      avatarUrl: newAvatarUrl,
      user,
    });
  } catch (error) {
    console.error('[Upload Avatar Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to update profile picture' });
  }
};

/**
 * @desc    Update or toggle candidate skills in database
 * @route   POST /api/profile/skills
 * @access  Private
 */
const updateSkills = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { skills, action, skill } = req.body;

    if (Array.isArray(skills)) {
      user.skills = skills.map((s) => String(s).trim()).filter(Boolean);
    } else if (action === 'add' && skill) {
      const cleanSkill = String(skill).trim();
      if (cleanSkill && !user.skills.includes(cleanSkill)) {
        user.skills.push(cleanSkill);
      }
    } else if (action === 'remove' && skill) {
      const cleanSkill = String(skill).trim();
      user.skills = user.skills.filter((s) => s !== cleanSkill);
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Skills updated successfully',
      skills: user.skills,
      user,
    });
  } catch (error) {
    console.error('[Update Skills Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to update skills' });
  }
};

/**
 * @desc    Update or toggle career interests in database
 * @route   POST /api/profile/interests
 * @access  Private
 */
const updateInterests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { careerInterests, action, interest } = req.body;

    if (Array.isArray(careerInterests)) {
      user.careerInterests = careerInterests.map((i) => String(i).trim()).filter(Boolean);
    } else if (action === 'add' && interest) {
      const cleanInterest = String(interest).trim();
      if (cleanInterest && !user.careerInterests.includes(cleanInterest)) {
        user.careerInterests.push(cleanInterest);
      }
    } else if (action === 'remove' && interest) {
      const cleanInterest = String(interest).trim();
      user.careerInterests = user.careerInterests.filter((i) => i !== cleanInterest);
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: 'Career interests updated successfully',
      careerInterests: user.careerInterests,
      user,
    });
  } catch (error) {
    console.error('[Update Interests Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to update career interests' });
  }
};

/**
 * @desc    Update candidate LinkedIn integration in database
 * @route   POST /api/profile/linkedin
 * @access  Private
 */
const updateLinkedin = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { profileUrl, name, action } = req.body;

    if (action === 'disconnect') {
      user.linkedin = {
        connected: false,
        profileUrl: '',
        name: '',
        username: '',
      };
    } else {
      let cleanUrl = String(profileUrl || '').trim();
      if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      user.linkedin = {
        connected: true,
        profileUrl: cleanUrl,
        name: name ? String(name).trim() : `${user.firstName} ${user.lastName}`,
        username: cleanUrl.split('/in/')[1]?.replace(/\/+$/, '') || user.firstName,
      };
    }

    await user.save();
    return res.status(200).json({
      success: true,
      message: user.linkedin.connected ? 'LinkedIn connected successfully' : 'LinkedIn disconnected',
      linkedin: user.linkedin,
      user,
    });
  } catch (error) {
    console.error('[Update LinkedIn Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to update LinkedIn' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadResumeFile,
  deleteResumeFile,
  uploadAvatarFile,
  updateSkills,
  updateInterests,
  updateLinkedin,
  githubAuthRedirect,
  githubCallback,
  connectGithub,
  disconnectGithub,
  getGithubRepos,
  getGithubRepoReadme,
  completeProfileSetup,
  getResume,
};
