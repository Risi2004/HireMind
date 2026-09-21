const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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
    const { email, password, rememberMe } = req.body;

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
};



