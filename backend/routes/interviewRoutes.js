const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  analyzeResume,
  getSession,
  updateSession,
} = require('../controllers/interviewController');

// Multer memory storage configuration for PDF / DOCX files up to 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = file.originalname.toLowerCase().match(/\.[0-9a-z]+$/)?.[0];
    if (ext && allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid resume in PDF or DOCX format.'));
    }
  },
});

// Optional auth middleware that attaches req.user if valid token provided, but doesn't block if not
const optionalProtect = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query?.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key');
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    }
  } catch {
    // Non-blocking for guest sessions
  }
  next();
};

// Routes
router.post('/:sessionId/analyze-resume', optionalProtect, upload.single('resume'), analyzeResume);
router.get('/:sessionId', optionalProtect, getSession);
router.put('/:sessionId', optionalProtect, updateSession);

module.exports = router;
