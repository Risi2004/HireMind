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
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer for memory storage (max 5MB, image types only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed for profile picture'), false);
    }
  },
});

// Authentication & Profile Picture endpoints
router.post('/register', upload.single('avatar'), register);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.delete('/account', protect, deleteAccount);
// Secure streaming route from private Cloudflare R2 bucket
router.get('/avatar/:filename', getAvatar);

module.exports = router;



