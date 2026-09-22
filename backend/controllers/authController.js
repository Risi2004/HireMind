const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { uploadProfilePicture, getPrivateAvatarStream, deleteAvatar, deleteResume } = require('../services/cloudflareR2');
const { sendOtpEmail, sendOnboardingEmail, sendPasswordResetOtpEmail, sendAccountDeletionEmail } = require('../services/emailService');




// Helper to generate signed JWT
const generateToken = (userId, email, rememberMe = false) => {
  return jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key',
    { expiresIn: rememberMe ? '30d' : '7d' }
  );
};

// Generate 6-digit numeric OTP
const generateNumericOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * @desc    Register a new user (saves pending user, uploads avatar, dispatches OTP)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. First & Last Name validation (must not contain numbers, only letters, hyphens, spaces, apostrophes)
    const nameHasNumbersRegex = /\d/;
    const nameValidRegex = /^[a-zA-Z\s'-]{2,50}$/;

    if (nameHasNumbersRegex.test(firstName)) {
      return res.status(400).json({ message: 'First name cannot contain numbers' });
    }
    if (!nameValidRegex.test(firstName.trim())) {
      return res.status(400).json({ message: 'First name must contain only letters (at least 2 characters)' });
    }

    if (nameHasNumbersRegex.test(lastName)) {
      return res.status(400).json({ message: 'Last name cannot contain numbers' });
    }
    if (!nameValidRegex.test(lastName.trim())) {
      return res.status(400).json({ message: 'Last name must contain only letters (at least 2 characters)' });
    }

    // 2. Email format validation with regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address (e.g. user@example.com)' });
    }

    // 3. Password rules with regex patterns:
    // - At least 8 characters
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    // - Uppercase letter
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one uppercase letter (A-Z)' });
    }
    // - Lowercase letter
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one lowercase letter (a-z)' });
    }
    // - Digit/Number
    if (!/\d/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one number (0-9)' });
    }
    // - Symbol / Special character
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      return res.status(400).json({ message: 'Password must contain at least one special symbol (!@#$%^&*)' });
    }
    // - No spaces
    if (/\s/.test(password)) {
      return res.status(400).json({ message: 'Password cannot contain spaces' });
    }
    // - No 3 or more repeated characters in a row
    if (/(.)\1{2,}/.test(password)) {
      return res.status(400).json({ message: 'Password cannot contain 3 or more repeated characters in a row' });
    }
    // - No keyboard walks or sequential patterns
    const keyboardWalkRegex = /(?:qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz|rewq|trew|ytre|iuyt|oiuy|poiu|lkjh|kjhg|jhgf|hgfd|gfed|fdsa|mnbv|nbvc|bvcx|vcxz|4321|5432|6543|7654|8765|9876|0987|dcba|edcb|fedc|gfed|hgfe|ihgf|jihg|kjih|lkji|mlkj|nmlk|onml|ponm|qpon|rqpo|srqp|tsrq|utsr|vuts|wvut|xwvu|yxwv|zyxw)/i;
    if (keyboardWalkRegex.test(password)) {
      return res.status(400).json({ message: 'Password cannot contain keyboard walks or sequential patterns (e.g. qwerty, 1234, abcd)' });
    }

    // 4. Profile picture validation (if attached)
    if (req.file) {
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: 'Profile picture must be less than 5MB' });
      }
      const isJpgPng = /\.(jpe?g|png)$/i.test(req.file.originalname) && /^image\/(jpeg|png)$/i.test(req.file.mimetype);
      if (!isJpgPng) {
        return res.status(400).json({ message: 'Profile picture must be a JPG, JPEG, or PNG image under 5MB' });
      }
    }

    // Check if user already exists and is verified
    const existingVerifiedUser = await User.findOne({ email: normalizedEmail, isVerified: true });
    if (existingVerifiedUser) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in.' });
    }

    // Upload profile picture to Cloudflare R2 if attached
    let avatarUrl = '';
    if (req.file) {
      avatarUrl = await uploadProfilePicture(req.file);
    }

    // Check if an unverified registration already exists
    let user = await User.findOne({ email: normalizedEmail, isVerified: false });
    if (user) {
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.password = password; // Will be hashed by pre('save')
      if (avatarUrl) {
        if (user.avatarUrl && user.avatarUrl !== avatarUrl) {
          await deleteAvatar(user.avatarUrl);
        }
        user.avatarUrl = avatarUrl;
      }
      await user.save();
    } else {
      user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
        avatarUrl,
        isVerified: false,
      });
      await user.save();
    }

    // Generate and store OTP
    const otpCode = generateNumericOtp();
    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({
      email: normalizedEmail,
      otp: otpCode,
    });

    // Send verification email
    await sendOtpEmail(normalizedEmail, otpCode, firstName.trim());

    return res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please verify to activate your account.',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[Auth Register Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

/**
 * @desc    Verify OTP code and activate user account
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the latest OTP record
    const otpRecord = await Otp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (!otpRecord || otpRecord.otp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Find and verify user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User record not found' });
    }

    user.isVerified = true;
    await user.save();

    // Delete used OTP
    await Otp.deleteMany({ email: normalizedEmail });

    // Send Onboarding Welcome Email with dynamic links from .env
    sendOnboardingEmail(user.email, user.firstName).catch((err) =>
      console.error('[Onboarding Email Error]:', err)
    );

    // Issue JWT token
    const token = generateToken(user._id, user.email, false);

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully!',
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth Verify OTP Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error during OTP verification' });
  }
};

/**
 * @desc    Resend OTP verification code
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account is already verified. Please sign in.' });
    }

    const otpCode = generateNumericOtp();
    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({
      email: normalizedEmail,
      otp: otpCode,
    });

    await sendOtpEmail(normalizedEmail, otpCode, user.firstName);

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.',
    });
  } catch (error) {
    console.error('[Auth Resend OTP Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error while resending OTP' });
  }
};

/**
 * @desc    Authenticate user & get JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password, rememberMe, trustedDeviceToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Include masked password explicitly for comparison
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify account status
    if (!user.isVerified) {
      // Auto-send fresh OTP so they can complete verification easily
      const otpCode = generateNumericOtp();
      await Otp.deleteMany({ email: normalizedEmail });
      await Otp.create({ email: normalizedEmail, otp: otpCode });
      sendOtpEmail(normalizedEmail, otpCode, user.firstName).catch(() => {});

      return res.status(403).json({
        message: 'Your account is not verified yet. A verification code has been sent to your email.',
        needsVerification: true,
        email: normalizedEmail,
      });
    }

    // Check if Two-Factor Authentication is enabled on this account
    if (user.twoFactorEnabled) {
      const incomingDeviceToken = trustedDeviceToken || req.headers['x-device-token'];
      let isDeviceTrusted = false;

      if (
        user.twoFactorFrequency === 'every_two_weeks' &&
        incomingDeviceToken &&
        Array.isArray(user.twoFactorTrustedDevices)
      ) {
        const now = new Date();
        const activeDevice = user.twoFactorTrustedDevices.find(
          (d) => d.deviceToken === incomingDeviceToken && new Date(d.expiresAt) > now
        );
        if (activeDevice) {
          isDeviceTrusted = true;
        }
      }

      if (!isDeviceTrusted) {
        // Issue temporary 2FA verification token valid for 10 minutes
        const tempToken = jwt.sign(
          { id: user._id, email: user.email, step: '2fa', rememberMe: !!rememberMe },
          process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key',
          { expiresIn: '10m' }
        );

        return res.status(200).json({
          success: true,
          requires2FA: true,
          tempToken,
          frequency: user.twoFactorFrequency || 'always',
          email: user.email,
          message: 'Authenticator code required to sign in.',
        });
      }
    }

    const token = generateToken(user._id, user.email, !!rememberMe);

    return res.status(200).json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth Login Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error fetching user profile' });
  }
};

/**
 * @desc    Stream avatar securely from private Cloudflare R2 bucket
 * @route   GET /api/auth/avatar/:filename
 * @access  Public
 */
const getAvatar = async (req, res) => {

  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const key = `avatars/${safeFilename}`;

    const streamObj = await getPrivateAvatarStream(key);
    if (!streamObj || !streamObj.Body) {
      return res.status(404).json({ message: 'Avatar not found' });
    }

    res.setHeader('Content-Type', streamObj.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    streamObj.Body.pipe(res);
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ message: 'Avatar not found' });
    }
    console.error('[Get Avatar Error]:', error);
    return res.status(500).json({ message: 'Failed to retrieve avatar' });
  }
};

/**
 * @desc    Initiate forgot password flow by dispatching a 6-digit OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    const otpCode = generateNumericOtp();
    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({
      email: normalizedEmail,
      otp: otpCode,
    });

    await sendPasswordResetOtpEmail(normalizedEmail, otpCode, user.firstName);

    return res.status(200).json({
      success: true,
      message: 'Password reset code has been sent to your email.',
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[Forgot Password Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error initiating password reset' });
  }
};

/**
 * @desc    Verify OTP and reset user password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const otpRecord = await Otp.findOne({ email: normalizedEmail }).sort({ createdAt: -1 });
    if (!otpRecord || otpRecord.otp !== otp.toString().trim()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await Otp.deleteMany({ email: normalizedEmail });

    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully. You can now log in.',
    });
  } catch (error) {
    console.error('[Reset Password Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error resetting password' });
  }
};

/**
 * @desc    Delete candidate account, avatar from Cloudflare R2, and all associated data
 * @route   DELETE /api/auth/account
 * @access  Private
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body || {};

    // Retrieve user with password for verification
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify password if provided
    if (password) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password. Account deletion aborted.' });
      }
    }

    // Delete candidate profile picture from storage if present
    if (user.avatarUrl) {
      try {
        await deleteAvatar(user.avatarUrl);
      } catch (avatarErr) {
        console.warn('[Delete Account] Warning: Failed to purge avatar:', avatarErr.message);
      }
    }

    // Delete candidate resume from storage if present
    if (user.resumeUrl) {
      try {
        await deleteResume(user.resumeUrl);
      } catch (resumeErr) {
        console.warn('[Delete Account] Warning: Failed to purge resume:', resumeErr.message);
      }
    }

    // Send account deletion confirmation email
    await sendAccountDeletionEmail(user.email, user.firstName);

    // Delete any pending OTPs for the user's email
    await Otp.deleteMany({ email: user.email });

    // Permanently remove the user from MongoDB
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'Account and associated data deleted successfully.',
    });
  } catch (error) {
    console.error('[Delete Account Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error deleting account' });
  }
};

/**
 * @desc    Generate 2FA secret and QR code for authenticator apps (Google Authenticator, Microsoft Authenticator, Apple)
 * @route   POST /api/auth/2fa/setup
 * @access  Private
 */
const generate2FASetup = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const secret = generateSecret();
    const uri = generateURI({
      issuer: 'HireMind',
      label: user.email,
      secret,
    });

    // Provide image query param for apps that display custom icons (2FAS, Bitwarden, Aegis, 1Password)
    const baseUrl = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5000').replace(/\/+$/, '');
    const logoUrl = `${baseUrl}/api/auth/logo.png`;
    const fullOtpauthUrl = `${uri}&image=${encodeURIComponent(logoUrl)}`;

    const qrCodeUrl = await QRCode.toDataURL(fullOtpauthUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#0a0f1d',
        light: '#ffffff',
      },
      width: 280,
    });

    return res.status(200).json({
      success: true,
      secret,
      qrCodeUrl,
      otpauthUrl: fullOtpauthUrl,
      manualEntryKey: secret,
      accountEmail: user.email,
      issuer: 'HireMind',
    });
  } catch (error) {
    console.error('[Generate 2FA Setup Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate 2FA setup' });
  }
};

/**
 * @desc    Verify TOTP token & activate 2FA with user frequency preference
 * @route   POST /api/auth/2fa/enable
 * @access  Private
 */
const enable2FA = async (req, res) => {
  try {
    const user = req.user;
    const { secret, code, frequency } = req.body;

    if (!secret || !code) {
      return res.status(400).json({ message: 'Authenticator secret and 6-digit verification code are required' });
    }

    // Verify token with window 1 (allowing +/- 30s time drift)
    const verification = verifySync({
      token: code.toString().trim(),
      secret,
      window: 1,
    });

    if (!verification || !verification.valid) {
      return res.status(400).json({ message: 'Invalid verification code. Please check your authenticator app and try again.' });
    }

    // Update user
    const dbUser = await User.findById(user._id).select('+twoFactorSecret');
    dbUser.twoFactorEnabled = true;
    dbUser.twoFactorSecret = secret;
    dbUser.twoFactorFrequency = frequency === 'every_two_weeks' ? 'every_two_weeks' : 'always';

    let trustedDeviceToken = null;
    if (dbUser.twoFactorFrequency === 'every_two_weeks') {
      trustedDeviceToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      dbUser.twoFactorTrustedDevices = dbUser.twoFactorTrustedDevices || [];
      dbUser.twoFactorTrustedDevices.push({
        deviceToken: trustedDeviceToken,
        expiresAt,
        userAgent: req.headers['user-agent'] || '',
      });
    }

    await dbUser.save();

    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication successfully enabled!',
      twoFactorEnabled: true,
      twoFactorFrequency: dbUser.twoFactorFrequency,
      trustedDeviceToken,
      user: dbUser,
    });
  } catch (error) {
    console.error('[Enable 2FA Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to enable two-factor authentication' });
  }
};

/**
 * @desc    Disable 2FA for authenticated user
 * @route   POST /api/auth/2fa/disable
 * @access  Private
 */
const disable2FA = async (req, res) => {
  try {
    const user = req.user;
    const dbUser = await User.findById(user._id).select('+twoFactorSecret');
    if (!dbUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    dbUser.twoFactorEnabled = false;
    dbUser.twoFactorSecret = '';
    dbUser.twoFactorFrequency = 'always';
    dbUser.twoFactorTrustedDevices = [];

    await dbUser.save();

    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
      twoFactorEnabled: false,
      user: dbUser,
    });
  } catch (error) {
    console.error('[Disable 2FA Error]:', error);
    return res.status(500).json({ message: error.message || 'Failed to disable two-factor authentication' });
  }
};

/**
 * @desc    Verify 2FA code during login
 * @route   POST /api/auth/2fa/verify-login
 * @access  Public (Requires valid tempToken)
 */
const verify2FALogin = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Session token and 6-digit verification code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key');
    } catch (err) {
      return res.status(401).json({ message: 'Your login session has expired. Please enter your credentials again.' });
    }

    if (decoded.step !== '2fa') {
      return res.status(400).json({ message: 'Invalid authentication session' });
    }

    const user = await User.findById(decoded.id).select('+twoFactorSecret');
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Two-factor authentication is not active on this account' });
    }

    const verification = verifySync({
      token: code.toString().trim(),
      secret: user.twoFactorSecret,
      window: 1,
    });

    if (!verification || !verification.valid) {
      return res.status(400).json({ message: 'Invalid 6-digit authenticator code. Please try again.' });
    }

    let trustedDeviceToken = null;
    if (user.twoFactorFrequency === 'every_two_weeks') {
      trustedDeviceToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      user.twoFactorTrustedDevices = (user.twoFactorTrustedDevices || []).filter(
        (d) => new Date(d.expiresAt) > new Date()
      );
      user.twoFactorTrustedDevices.push({
        deviceToken: trustedDeviceToken,
        expiresAt,
        userAgent: req.headers['user-agent'] || '',
      });
      await user.save();
    }

    const token = generateToken(user._id, user.email, !!decoded.rememberMe);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully!',
      token,
      user,
      trustedDeviceToken,
    });
  } catch (error) {
    console.error('[Verify 2FA Login Error]:', error);
    return res.status(500).json({ message: error.message || 'Server error verifying 2FA code' });
  }
};

/**
 * @desc    Serve official brand logo for authenticator apps and QR codes
 * @route   GET /api/auth/logo.png
 * @access  Public
 */
const getBrandLogo = (req, res) => {
  const logoPath = path.join(__dirname, '../assets/logo.png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Type', 'image/png');
  return res.sendFile(logoPath);
};

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  getAvatar,
  forgotPassword,
  resetPassword,
  deleteAccount,
  generate2FASetup,
  enable2FA,
  disable2FA,
  verify2FALogin,
  getBrandLogo,
};



