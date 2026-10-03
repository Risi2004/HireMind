const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const { extractToken, verifySessionToken } = require('../config/authToken');
const { isAdminUser } = require('./authMiddleware');

/**
 * Middleware that strictly protects AI Interview execution.
 * Rules:
 * 1. Requires valid authentication token.
 * 2. Administrators have unrestricted access.
 * 3. Regular users must have active demoAccess enabled by an Admin AND must have remaining interview quota.
 * 4. Newly signed-up users or standard candidates without demo access receive a 403 Coming Soon response.
 * 5. Users who exhausted their demo quota receive a 403 Quota Exceeded response.
 */
const requireInterviewDemoAccess = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to access AI Mock Interview.',
      });
    }

    const decoded = verifySessionToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or token expired.',
      });
    }

    req.user = user;

    // 1. Administrators always have unlimited access
    if (isAdminUser(user)) {
      req.isAdmin = true;
      return next();
    }

    const demo = user.demoAccess || {};

    // 2. Check if admin has enabled demo access for this member
    if (!demo.enabled) {
      return res.status(403).json({
        success: false,
        isComingSoon: true,
        hasDemoAccess: false,
        message:
          'AI Mock Interview is currently in private preview. This feature is coming soon for general access. Please contact an administrator to request demo account access.',
      });
    }

    const allowed = Number(demo.allowedInterviews) || 0;
    const completed = Number(demo.completedInterviews) || 0;

    // 3. Check if user still has remaining interview attempts.
    // A session that already consumed a pass may continue (so the quota is not
    // re-checked mid-interview after the pass was deducted at start).
    if (completed >= allowed) {
      const sessionId = req.params?.sessionId;
      const alreadyCounted = sessionId
        ? await InterviewSession.exists({ sessionId, userId: user._id, isDemoCounted: true })
        : null;

      if (!alreadyCounted) {
        return res.status(403).json({
          success: false,
          isComingSoon: false,
          quotaExceeded: true,
          hasDemoAccess: true,
          allowedInterviews: allowed,
          completedInterviews: completed,
          remainingInterviews: 0,
          message: `You have completed all ${allowed} of your allocated demo interview attempts. Please contact an administrator to refresh your interview count.`,
        });
      }
    }

    // 4. User is authorized with remaining demo passes
    req.demoAccess = {
      allowed,
      completed,
      remaining: Math.max(0, allowed - completed),
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication session.',
    });
  }
};

/**
 * Ensures the authenticated user owns the interview session in :sessionId.
 * - Sessions owned by another user are rejected with 403 (admins excepted).
 * - Legacy sessions without an owner are claimed by the current user.
 * - Sessions that do not exist yet pass through (handlers create them for req.user).
 * Must run after protect / requireInterviewDemoAccess.
 */
const requireSessionOwnership = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 128) {
      return res.status(400).json({ success: false, message: 'Invalid interview session ID.' });
    }

    const session = await InterviewSession.findOne({ sessionId }).select('userId').lean();
    if (!session) return next();

    if (!session.userId) {
      await InterviewSession.updateOne({ sessionId, userId: null }, { $set: { userId: req.user._id } });
      return next();
    }

    if (session.userId.toString() !== req.user._id.toString() && !isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this interview session.' });
    }

    return next();
  } catch (error) {
    console.error('[Session Ownership] Error verifying session owner:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to verify interview session access.' });
  }
};

/**
 * Consumes one demo interview pass for the session owner.
 * Idempotent per session: the session's isDemoCounted flag is flipped atomically,
 * so concurrent calls (begin / end / evaluate) can never deduct twice.
 *
 * @param {Object} session - InterviewSession mongoose document
 * @returns {Promise<Object|null>} Updated demoAccess object or null
 */
const recordCompletedDemoInterview = async (session) => {
  try {
    if (!session || !session.userId) return null;

    const candidate = await User.findById(session.userId);
    if (!candidate) return null;

    // Admins do not consume demo quota
    if (isAdminUser(candidate)) {
      return candidate.demoAccess || null;
    }

    if (!candidate.demoAccess || !candidate.demoAccess.enabled) {
      return null;
    }

    // Atomically claim this session for quota counting
    const claimed = await InterviewSession.findOneAndUpdate(
      { _id: session._id, isDemoCounted: { $ne: true } },
      { $set: { isDemoCounted: true } },
      { new: true }
    );
    session.isDemoCounted = true;

    if (!claimed) {
      return null; // Already counted
    }

    const updated = await User.findByIdAndUpdate(
      candidate._id,
      { $inc: { 'demoAccess.completedInterviews': 1 } },
      { new: true }
    );

    const allowed = Number(updated.demoAccess.allowedInterviews) || 0;
    const completed = Number(updated.demoAccess.completedInterviews) || 0;
    const remaining = Math.max(0, allowed - completed);
    console.log(
      `[Demo Access] Deducted quota for ${updated.email}: completed=${completed} / allowed=${allowed} (remaining: ${remaining})`
    );

    return {
      enabled: Boolean(updated.demoAccess.enabled),
      allowedInterviews: allowed,
      completedInterviews: completed,
      remainingInterviews: remaining,
      notes: updated.demoAccess.notes || '',
    };
  } catch (err) {
    console.error('[Demo Access] Error recording demo interview:', err.message);
    return null;
  }
};

module.exports = {
  requireInterviewDemoAccess,
  requireSessionOwnership,
  recordCompletedDemoInterview,
};
