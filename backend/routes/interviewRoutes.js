const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  analyzeResume,
  analyzeJobDescription,
  getSession,
  updateSession,
  deleteSession,
  generateInterviewPlan,
  sendChatMessage,
  beginLiveInterview,
  submitLiveAnswer,
  manualEndLiveInterview,
  getOrGenerateEvaluation,
  transcribeCandidateVoice,
  synthesizeInterviewerSpeech,
  runCode,
  submitCodeSolution,
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

// Multer memory storage configuration for Voice Audio recordings up to 25MB
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/webm' ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid audio recording (webm, wav, mp3, ogg, mp4).'));
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
router.post('/:sessionId/analyze-jd', optionalProtect, analyzeJobDescription);
router.post('/:sessionId/plan', optionalProtect, generateInterviewPlan);
router.post('/:sessionId/begin', optionalProtect, beginLiveInterview);
router.post('/:sessionId/answer', optionalProtect, submitLiveAnswer);
router.post('/:sessionId/voice/transcribe', optionalProtect, audioUpload.single('audio'), transcribeCandidateVoice);
router.post('/:sessionId/voice/speech', optionalProtect, synthesizeInterviewerSpeech);
router.post('/:sessionId/code/run', optionalProtect, runCode);
router.post('/:sessionId/code/submit', optionalProtect, submitCodeSolution);
router.post('/:sessionId/end', optionalProtect, manualEndLiveInterview);
router.post('/:sessionId/chat', optionalProtect, sendChatMessage);
router.get('/:sessionId/evaluation', optionalProtect, getOrGenerateEvaluation);
router.post('/:sessionId/evaluate', optionalProtect, getOrGenerateEvaluation);
router.get('/:sessionId', optionalProtect, getSession);
router.put('/:sessionId', optionalProtect, updateSession);
router.delete('/:sessionId', optionalProtect, deleteSession);

module.exports = router;

