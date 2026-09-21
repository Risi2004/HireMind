const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  completeProfileSetup,
  connectGithub,
  disconnectGithub,
  getResume,
} = require('../controllers/profileController');

const router = express.Router();

// Memory storage for file uploads before forwarding to Cloudflare R2
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max resume file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream',
    ];
    const allowedExts = ['.pdf', '.doc', '.docx'];
    const hasAllowedExt = allowedExts.some((ext) => file.originalname.toLowerCase().endsWith(ext));

    if (allowedMimes.includes(file.mimetype) || hasAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .doc, and .docx resumes are accepted'));
    }
  },
});

// Setup profile (field, careerStage, experienceLevel, Cloudflare R2 resume)
router.post('/setup', protect, upload.single('resume'), completeProfileSetup);

// GitHub connection endpoints
router.post('/github/connect', protect, connectGithub);
router.post('/github/disconnect', protect, disconnectGithub);

// Secure private Cloudflare R2 resume streaming
router.get('/resume/:filename', protect, getResume);

module.exports = router;
