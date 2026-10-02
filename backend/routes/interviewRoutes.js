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
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.query?.token) {
      token = req.query.token;
    } else if (req.body?.token) {
      token = req.body.token;
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

const { requireInterviewDemoAccess } = require('../middleware/demoAccessMiddleware');
const { subscribe } = require('../services/realtimeService');

// Live Real-Time Events SSE Stream for candidate dashboards
router.get('/live-events', optionalProtect, (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: 'Authentication required for real-time live events.' });
  }
  subscribe(req.user._id, req, res);
});

// Check candidate's AI Interview Demo Access status
router.get('/access-status', optionalProtect, (req, res) => {
  if (!req.user) {
    return res.status(200).json({
      success: true,
      canAccess: false,
      isAuthenticated: false,
      isComingSoon: true,
      hasDemoAccess: false,
      allowedInterviews: 0,
      completedInterviews: 0,
      remainingInterviews: 0,
      message: 'Please sign in to access AI Mock Interview.',
    });
  }

  // 1. Administrators have unrestricted access
  if (req.user.role === 'admin' || req.user.email === 'admin@gmail.com') {
    return res.status(200).json({
      success: true,
      canAccess: true,
      isAdmin: true,
      isAuthenticated: true,
      isProfileSetupCompleted: true,
      isComingSoon: false,
      hasDemoAccess: true,
      allowedInterviews: 9999,
      completedInterviews: 0,
      remainingInterviews: 9999,
      message: 'Administrator unrestricted access.',
    });
  }

  // 2. Regular candidate demo access check
  const demo = req.user.demoAccess || {};
  const allowed = Number(demo.allowedInterviews) || 0;
  const completed = Number(demo.completedInterviews) || 0;
  const remaining = Math.max(0, allowed - completed);
  const isEnabled = Boolean(demo.enabled);
  const canAccess = isEnabled && remaining > 0;

  return res.status(200).json({
    success: true,
    canAccess,
    isAdmin: false,
    isAuthenticated: true,
    isProfileSetupCompleted: Boolean(req.user.isProfileSetupCompleted),
    isComingSoon: !isEnabled,
    quotaExceeded: isEnabled && remaining === 0,
    hasDemoAccess: isEnabled,
    allowedInterviews: allowed,
    completedInterviews: completed,
    remainingInterviews: remaining,
    notes: demo.notes || '',
    message: canAccess
      ? `Demo access active. ${remaining} of ${allowed} interview(s) remaining.`
      : !isEnabled
      ? 'AI Mock Interview is currently in private preview. This feature is coming soon for general access. Please contact an administrator for demo access.'
      : `You have completed all ${allowed} allocated demo interviews. Contact an administrator to refresh your count.`,
  });
});

// Routes with High Security Demo Access Protection
router.post('/:sessionId/analyze-resume', requireInterviewDemoAccess, upload.single('resume'), analyzeResume);
router.post('/:sessionId/analyze-jd', requireInterviewDemoAccess, analyzeJobDescription);
router.post('/:sessionId/plan', requireInterviewDemoAccess, generateInterviewPlan);
router.post('/:sessionId/begin', requireInterviewDemoAccess, beginLiveInterview);
router.post('/:sessionId/answer', requireInterviewDemoAccess, submitLiveAnswer);
router.post('/:sessionId/voice/transcribe', requireInterviewDemoAccess, audioUpload.single('audio'), transcribeCandidateVoice);
router.post('/:sessionId/voice/speech', requireInterviewDemoAccess, synthesizeInterviewerSpeech);
router.post('/:sessionId/code/run', requireInterviewDemoAccess, runCode);
router.post('/:sessionId/code/submit', requireInterviewDemoAccess, submitCodeSolution);
router.post('/:sessionId/end', optionalProtect, manualEndLiveInterview);
router.post('/:sessionId/chat', requireInterviewDemoAccess, sendChatMessage);
router.get('/:sessionId/evaluation', optionalProtect, getOrGenerateEvaluation);
router.post('/:sessionId/evaluate', optionalProtect, getOrGenerateEvaluation);
router.get('/:sessionId', optionalProtect, getSession);
router.put('/:sessionId', optionalProtect, updateSession);
router.delete('/:sessionId', optionalProtect, deleteSession);

module.exports = router;

