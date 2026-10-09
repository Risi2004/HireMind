const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret, verifySessionToken } = require('../config/authToken');
const {
  uploadResume,
  getPrivateResumeStream,
  deleteResume,
  uploadProfilePicture,
  deleteAvatar,
} = require('../services/cloudflareR2');
const { getClientUrl } = require('../config/clientConfig');
const { getAiServiceUrl, getAiServiceHeaders } = require('../config/aiServiceConfig');
const AI_SERVICE_URL = getAiServiceUrl();

/**
 * Helper to convert a readable stream into a Buffer
 */
const streamToBuffer = async (readableStream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
};

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

const GITHUB_OAUTH_COOKIE = 'hm_gh_oauth';
const GITHUB_OAUTH_TTL_MS = 10 * 60 * 1000;

/**
 * Only allow same-app relative paths like "/profile" or "/new-interview/abc".
 * Rejects absolute URLs, protocol-relative "//evil.com" and "@evil.com" style tricks.
 */
const sanitizeRedirectPath = (value) => {
  const fallback = '/profile-setup';
  if (typeof value !== 'string') return fallback;
  return /^\/(?!\/)[A-Za-z0-9\-_/]{0,200}$/.test(value) ? value : fallback;
};

const readCookie = (req, name) => {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
};

const githubCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // sent on the top-level redirect back from github.com
  path: '/api/profile/github',
  maxAge: GITHUB_OAUTH_TTL_MS,
});

/**
 * @desc    Initiate GitHub OAuth 2.0 Authorization Flow
 * @route   GET /api/profile/github/auth
 * @access  Public (Validated via JWT query param or Header)
 */
const githubAuthRedirect = async (req, res) => {
  try {
    const clientUrl = getClientUrl();
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectParam = sanitizeRedirectPath(req.query.redirect);

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
      decoded = verifySessionToken(token);
    } catch (jwtErr) {
      return res.redirect(`${clientUrl}/login?error=invalid_token`);
    }

    if (!clientId) {
      console.warn('[GitHub OAuth] GITHUB_CLIENT_ID not configured in backend/.env');
      return res.redirect(`${clientUrl}${redirectParam}?github_error=oauth_not_configured`);
    }

    const backendBase = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const callbackUrl = process.env.GITHUB_CALLBACK_URL || `${backendBase}/api/profile/github/callback`;

    // Signed, short-lived state bound to THIS browser via an httpOnly nonce cookie.
    // Without the cookie match, a state generated by someone else (e.g. an attacker
    // tricking a victim into authorizing GitHub) is rejected in the callback.
    const nonce = crypto.randomBytes(24).toString('hex');
    const state = jwt.sign(
      { purpose: 'github_oauth', userId: decoded.id, redirect: redirectParam, nonce },
      getJwtSecret(),
      { expiresIn: Math.floor(GITHUB_OAUTH_TTL_MS / 1000) }
    );
    res.cookie(GITHUB_OAUTH_COOKIE, nonce, githubCookieOptions());

    // Scope: read:user (profile info) and repo (allows reading repos and code/README for interview analysis)
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&scope=read:user,repo&state=${state}`;

    return res.redirect(githubAuthUrl);
  } catch (error) {
    console.error('[GitHub Auth Error]:', error);
    const clientUrl = getClientUrl();
    return res.redirect(`${clientUrl}/profile-setup?github_error=failed_to_start_oauth`);
  }
};

/**
 * @desc    GitHub OAuth Callback (Exchanges code for access token & syncs repos)
 * @route   GET /api/profile/github/callback
 * @access  Public
 */
const githubCallback = async (req, res) => {
  const clientUrl = getClientUrl();
  const { code, state, error: ghError } = req.query;

  let redirectPath = '/profile-setup';
  let userId = null;

  const cookieNonce = readCookie(req, GITHUB_OAUTH_COOKIE);
  res.clearCookie(GITHUB_OAUTH_COOKIE, { ...githubCookieOptions(), maxAge: undefined });

  if (typeof state === 'string' && state) {
    try {
      const decodedState = jwt.verify(state, getJwtSecret());
      if (decodedState.purpose === 'github_oauth') {
        redirectPath = sanitizeRedirectPath(decodedState.redirect);
        const nonceMatches =
          typeof cookieNonce === 'string' &&
          typeof decodedState.nonce === 'string' &&
          cookieNonce.length === decodedState.nonce.length &&
          crypto.timingSafeEqual(Buffer.from(cookieNonce), Buffer.from(decodedState.nonce));
        if (nonceMatches && decodedState.userId) {
          userId = decodedState.userId;
        } else {
          console.warn('[GitHub OAuth] State nonce mismatch — possible CSRF, rejecting callback');
        }
      }
    } catch (e) {
      console.warn('[GitHub OAuth] Invalid or expired state:', e.message);
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

    let resumeUploadError = null;

    // Handle CV / Resume file upload to Cloudflare R2 if provided
    if (req.file) {
      const allowedExts = ['.pdf', '.doc', '.docx'];
      const fileExt = req.file.originalname.toLowerCase().match(/\.[0-9a-z]+$/)?.[0];

      if (!fileExt || !allowedExts.includes(fileExt)) {
        return res.status(400).json({ message: 'Please upload a valid resume in PDF or DOCX format.' });
      }

      // A storage failure must not block onboarding: the profile is still saved and the
      // candidate can upload the resume later from their profile page.
      try {
        const uploaded = await uploadResume(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        // Only remove the previous resume once the new one is safely stored
        if (user.resumeUrl) {
          await deleteResume(user.resumeUrl);
        }

        user.resumeUrl = uploaded.resumeUrl;
        user.resumeFileName = uploaded.originalFilename;
      } catch (uploadErr) {
        console.error('[Profile Setup] Resume upload failed (profile will still be saved):', uploadErr.message);
        resumeUploadError = 'Your profile was saved, but the resume could not be uploaded. Please upload it again from your profile.';
      }
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
      message: resumeUploadError || 'Profile setup completed successfully!',
      resumeUploadError,
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

    // Candidates may only stream their own resume; administrators may view any candidate's resume
    const ownKey = (req.user?.resumeUrl || '').split('/api/profile/resume/')[1] || '';
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && targetKey !== ownKey) {
      return res.status(404).json({ message: 'Resume document not found' });
    }
    if (!/^[A-Za-z0-9._-]+$/.test(targetKey)) {
      return res.status(400).json({ message: 'Invalid resume file request' });
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
      linkedin,
    } = req.body;
    // Note: `tier` (plan) and `role` are intentionally NOT user-editable.

    if (firstName !== undefined && firstName.trim()) user.firstName = firstName.trim();
    if (lastName !== undefined && lastName.trim()) user.lastName = lastName.trim();
    if (title !== undefined) user.title = String(title).trim();
    if (careerStage !== undefined) user.careerStage = String(careerStage).trim();
    if (field !== undefined) user.field = String(field).trim();
    if (experienceLevel !== undefined) user.experienceLevel = experienceLevel;
    if (bio !== undefined) user.bio = String(bio).trim();

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
 * @desc    Remove candidate avatar picture
 * @route   DELETE /api/profile/avatar
 * @access  Private
 */
const deleteAvatarFile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.avatarUrl) {
      try {
        await deleteAvatar(user.avatarUrl);
      } catch (storageErr) {
        console.warn('[Delete Avatar Storage Warning]:', storageErr.message);
      }
      user.avatarUrl = '';
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully!',
      avatarUrl: '',
      user,
    });
  } catch (error) {
    console.error('[Delete Avatar Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to remove profile picture' });
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

/**
 * @desc    Extract skills automatically from uploaded resume or profile resume
 * @route   POST /api/profile/extract-skills
 * @access  Private
 */
const extractSkills = async (req, res) => {
  try {
    let fileBuffer = null;
    let originalFilename = 'resume.pdf';
    let mimeType = 'application/pdf';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalFilename = req.file.originalname;
      mimeType = req.file.mimetype || 'application/pdf';
    } else if (
      req.body?.useProfileResume === 'true' ||
      req.body?.useProfileResume === true ||
      (!req.file && req.user?.resumeUrl)
    ) {
      const user = await User.findById(req.user._id);
      if (!user || (!user.resumeFileName && !user.resumeUrl)) {
        return res.status(404).json({ success: false, message: 'No resume found on user profile.' });
      }
      originalFilename = user.resumeFileName || 'profile-resume.pdf';
      try {
        const resumeKey = user.resumeUrl && user.resumeUrl.includes('/api/profile/resume/')
          ? `resumes/${user.resumeUrl.split('/api/profile/resume/')[1]}`
          : (user.resumeFileName || '');
        const streamData = await getPrivateResumeStream(resumeKey);
        fileBuffer = await streamToBuffer(streamData.Body);
        mimeType = streamData.ContentType || 'application/pdf';
      } catch (storageErr) {
        console.warn('[Profile Extract Skills] Cloudflare R2 fetch error:', storageErr.message);
        return res.status(404).json({ success: false, message: 'Could not access stored resume file.' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Please upload a resume file or select your profile resume.' });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ success: false, message: 'Resume file is empty.' });
    }

    // Call the Python AI Service (Google ADK Resume Analyzer)
    let rawSkills = [];
    let detectedRole = '';
    let yearsOfExperience = null;

    try {
      const formData = new FormData();
      const fileBlob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', fileBlob, originalFilename);

      const aiRes = await fetch(`${AI_SERVICE_URL}/agents/resume-analyzer/analyze`, {
        method: 'POST',
        headers: getAiServiceHeaders(),
        body: formData,
        signal: AbortSignal.timeout(60000),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const analysis = aiData.analysis || {};
        detectedRole = analysis.detected_role || '';
        yearsOfExperience = analysis.years_of_experience || null;
        const skillsObj = analysis.skills || {};
        rawSkills = [
          ...(Array.isArray(skillsObj.technical) ? skillsObj.technical : []),
          ...(Array.isArray(skillsObj.frameworks_and_tools) ? skillsObj.frameworks_and_tools : []),
        ];
        if (rawSkills.length === 0 && Array.isArray(skillsObj.soft_skills)) {
          rawSkills = skillsObj.soft_skills;
        }
      } else {
        const errText = await aiRes.text();
        console.warn(`[Profile Extract Skills] AI service returned ${aiRes.status}:`, errText.slice(0, 200));
      }
    } catch (aiErr) {
      console.warn('[Profile Extract Skills] AI service unreachable:', aiErr.message);
    }

    // Fallback: If AI service could not return skills (e.g. offline or unparseable), scan text for skills
    if (rawSkills.length === 0) {
      try {
        const textSample = fileBuffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        const KNOWN_KEYWORDS = [
          'React', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'Java', 'C++', 'C#',
          'HTML5', 'HTML', 'CSS3', 'CSS', 'Next.js', 'Vue.js', 'Angular', 'Express',
          'Django', 'Flask', 'FastAPI', 'Spring Boot', 'SQL', 'PostgreSQL', 'MySQL',
          'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Google Cloud', 'GCP',
          'Azure', 'Git', 'Linux', 'REST APIs', 'GraphQL', 'Microservices', 'PyTorch',
          'TensorFlow', 'Data Science', 'Pandas', 'NumPy', 'Figma', 'CI/CD', 'Go',
          'Rust', 'Swift', 'Kotlin', 'Flutter', 'Tailwind', 'Sass', 'Redux', 'Jest',
          'Webpack', 'Vite'
        ];
        for (const kw of KNOWN_KEYWORDS) {
          const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(textSample)) {
            rawSkills.push(kw);
          }
        }
      } catch (fallbackErr) {
        console.warn('[Profile Extract Skills] Keyword fallback error:', fallbackErr.message);
      }
    }

    // Strict deduplication: case-insensitive, trimmed, no empty items
    const seen = new Set();
    const cleanSkills = [];
    for (const s of rawSkills) {
      if (!s || typeof s !== 'string') continue;
      const trimmed = s.trim();
      if (!trimmed || trimmed.length > 50) continue;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        cleanSkills.push(trimmed);
      }
    }

    return res.status(200).json({
      success: true,
      skills: cleanSkills,
      detectedRole,
      yearsOfExperience,
      count: cleanSkills.length,
    });
  } catch (error) {
    console.error('[Profile Extract Skills Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to extract skills from resume' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadResumeFile,
  deleteResumeFile,
  uploadAvatarFile,
  deleteAvatarFile,
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
  extractSkills,
};
