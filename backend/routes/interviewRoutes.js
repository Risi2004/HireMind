const express = require('express');
const router = express.Router();
const multer = require('multer');
const InterviewSession = require('../models/InterviewSession');
const {
  analyzeResume,
  analyzeJobDescription,
  getSession,
  getMySessions,
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

const { protect, optionalProtect, isAdminUser } = require('../middleware/authMiddleware');
const { requireInterviewDemoAccess, requireSessionOwnership } = require('../middleware/demoAccessMiddleware');
const { subscribe } = require('../services/realtimeService');

// Live Real-Time Events SSE Stream for candidate dashboards
router.get('/live-events', optionalProtect, (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: 'Authentication required for real-time live events.' });
  }
  subscribe(req.user._id, req, res);
});

// Check candidate's AI Interview Demo Access status
router.get('/access-status', optionalProtect, async (req, res) => {
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
  if (isAdminUser(req.user)) {
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

  // An interview that already consumed its demo pass (at start) may be continued even
  // when no passes remain — otherwise the candidate is locked out of their own interview
  // right after the first question. Only unfinished sessions owned by this user qualify.
  let hasActiveSessionAccess = false;
  const { sessionId } = req.query;
  if (isEnabled && remaining === 0 && typeof sessionId === 'string' && sessionId && sessionId.length <= 128) {
    try {
      hasActiveSessionAccess = Boolean(
        await InterviewSession.exists({
          sessionId,
          userId: req.user._id,
          isDemoCounted: true,
          status: { $nin: ['completed', 'ended_by_user'] },
        })
      );
    } catch (err) {
      console.warn('[Access Status] Active session lookup failed:', err.message);
    }
  }

  const canAccess = isEnabled && (remaining > 0 || hasActiveSessionAccess);

  return res.status(200).json({
    success: true,
    canAccess,
    activeSessionAccess: hasActiveSessionAccess,
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

// Interview execution routes: demo access + session ownership required
const demoOwner = [requireInterviewDemoAccess, requireSessionOwnership];
// Read/manage routes: authenticated owner only (no demo quota needed to view past reports)
const owner = [protect, requireSessionOwnership];

router.post('/:sessionId/analyze-resume', ...demoOwner, upload.single('resume'), analyzeResume);
router.post('/:sessionId/analyze-jd', ...demoOwner, analyzeJobDescription);
router.post('/:sessionId/plan', ...demoOwner, generateInterviewPlan);
router.post('/:sessionId/begin', ...demoOwner, beginLiveInterview);
router.post('/:sessionId/answer', ...demoOwner, submitLiveAnswer);
router.post('/:sessionId/voice/transcribe', ...demoOwner, audioUpload.single('audio'), transcribeCandidateVoice);
router.post('/:sessionId/voice/speech', ...demoOwner, synthesizeInterviewerSpeech);
router.post('/:sessionId/code/run', ...demoOwner, runCode);
router.post('/:sessionId/code/submit', ...demoOwner, submitCodeSolution);
router.post('/:sessionId/chat', ...demoOwner, sendChatMessage);
router.post('/:sessionId/end', ...owner, manualEndLiveInterview);
router.get('/:sessionId/evaluation', ...owner, getOrGenerateEvaluation);
router.post('/:sessionId/evaluate', ...owner, getOrGenerateEvaluation);
router.get('/my-sessions', protect, getMySessions);
router.get('/:sessionId', ...owner, getSession);
router.put('/:sessionId', ...owner, updateSession);
router.delete('/:sessionId', ...owner, deleteSession);

module.exports = router;

