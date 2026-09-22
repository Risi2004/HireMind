const express = require('express');
const multer = require('multer');
const {
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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for memory storage (max 5MB, JPG/JPEG/PNG only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const isImageMime = /^image\/(jpeg|png)$/i.test(file.mimetype);
    const isImageExt = /\.(jpe?g|png)$/i.test(file.originalname);
    if (isImageMime && isImageExt) {
      cb(null, true);
    } else {
      cb(new Error('Profile picture must be a JPG, JPEG, or PNG image under 5MB'), false);
    }
  },
});

// Middleware to handle multer file upload errors gracefully
const handleAvatarUpload = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Profile picture must be less than 5MB' });
      }
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Authentication & Profile Picture endpoints
router.post('/register', handleAvatarUpload, register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.delete('/account', protect, deleteAccount);

// Two-Factor Authentication (MFA) endpoints
router.post('/2fa/setup', protect, generate2FASetup);
router.post('/2fa/enable', protect, enable2FA);
router.post('/2fa/disable', protect, disable2FA);
router.post('/2fa/verify-login', verify2FALogin);

// Secure streaming route from private Cloudflare R2 bucket
router.get('/avatar/:filename', getAvatar);

// Public brand logo for authenticator apps (Google Authenticator, Microsoft Authenticator, 2FAS, etc.)
router.get('/logo.png', getBrandLogo);

module.exports = router;



