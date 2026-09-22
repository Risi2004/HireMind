const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  uploadResumeFile,
  deleteResumeFile,
  uploadAvatarFile,
  updateSkills,
  updateInterests,
  updateLinkedin,
  completeProfileSetup,
  githubAuthRedirect,
  githubCallback,
  connectGithub,
  disconnectGithub,
  getGithubRepos,
  getGithubRepoReadme,
  getResume,
} = require('../controllers/profileController');

const router = express.Router();

// Memory storage for resume file uploads (max 10MB, PDF/DOC/DOCX)
const uploadResumeMulter = multer({
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

// Memory storage for avatar uploads (max 5MB, JPG/JPEG/PNG)
const uploadAvatarMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const isImageMime = /^image\/(jpeg|png)$/i.test(file.mimetype);
    const isImageExt = /\.(jpe?g|png)$/i.test(file.originalname);
    if (isImageMime && isImageExt) {
      cb(null, true);
    } else {
      cb(new Error('Profile picture must be a JPG, JPEG, or PNG image under 5MB'));
    }
  },
});

// Dynamic Profile endpoints
router.get('/me', protect, getProfile);
router.put('/', protect, updateProfile);
router.post('/skills', protect, updateSkills);
router.post('/interests', protect, updateInterests);
router.post('/linkedin', protect, updateLinkedin);

// Resume upload and management
router.post('/resume', protect, uploadResumeMulter.single('resume'), uploadResumeFile);
router.delete('/resume', protect, deleteResumeFile);

// Avatar picture upload
router.post('/avatar', protect, uploadAvatarMulter.single('avatar'), uploadAvatarFile);

// Setup profile (field, careerStage, experienceLevel, resume)
router.post('/setup', protect, uploadResumeMulter.single('resume'), completeProfileSetup);

// GitHub OAuth 2.0 endpoints
router.get('/github/auth', githubAuthRedirect);
router.get('/github/callback', githubCallback);

// GitHub manual connection and management
router.post('/github/connect', protect, connectGithub);
router.post('/github/disconnect', protect, disconnectGithub);

// GitHub repositories and code analysis endpoints
router.get('/github/repos', protect, getGithubRepos);
router.get('/github/repo/:owner/:repo/readme', protect, getGithubRepoReadme);

// Secure private Cloudflare R2 resume streaming
router.get('/resume/:filename', protect, getResume);

module.exports = router;
