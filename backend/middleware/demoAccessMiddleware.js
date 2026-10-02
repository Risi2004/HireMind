const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in to access AI Mock Interview.',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key'
    );
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found or token expired.',
      });
    }

    req.user = user;

    // 1. Administrators always have unlimited access
    if (user.role === 'admin' || user.email === 'admin@gmail.com') {
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

    // 3. Check if user still has remaining interview attempts
    if (completed >= allowed) {
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
      error: error.message,
    });
  }
};

/**
 * Tracks and increments the completed interviews count for demo users upon interview conclusion.
 * Avoids duplicate increments per session.
 *
 * @param {Object} session - InterviewSession mongoose document
 * @param {string|Object} userOrReq - User ID, User document, or Express req object
 * @returns {Promise<Object|null>} Updated demoAccess object or null
 */
const recordCompletedDemoInterview = async (session, userOrReq) => {
  try {
    if (!session) return null;
    if (session.isDemoCounted) {
      console.log(`[Demo Access Security] Session ${session.sessionId} is already counted.`);
      return null;
    }

    let targetUserId = null;
    if (userOrReq) {
      if (typeof userOrReq === 'string' && userOrReq.trim()) {
        targetUserId = userOrReq.trim();
      } else if (userOrReq._id) {
        targetUserId = userOrReq._id.toString();
      } else if (userOrReq.user && userOrReq.user._id) {
        targetUserId = userOrReq.user._id.toString();
      } else if (userOrReq.headers && userOrReq.headers.authorization) {
        try {
          const authHeader = userOrReq.headers.authorization;
          const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
          if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_hiremind_jwt_dev_key');
            if (decoded && decoded.id) {
              targetUserId = decoded.id.toString();
            }
          }
        } catch (_) {}
      }
    }

    if (!targetUserId && session.userId) {
      targetUserId = session.userId.toString();
    }

    if (!targetUserId) {
      console.warn(`[Demo Access Security] Cannot identify user for session ${session.sessionId}. Cannot record demo quota.`);
      return null;
    }

    const candidate = await User.findById(targetUserId);
    if (!candidate) {
      console.warn(`[Demo Access Security] Candidate with ID ${targetUserId} not found in DB.`);
      return null;
    }

    // Admins do not consume demo quota
    if (candidate.role === 'admin' || candidate.email === 'admin@gmail.com') {
      return candidate.demoAccess || null;
    }

    if (candidate.demoAccess && candidate.demoAccess.enabled) {
      const allowed = Number(candidate.demoAccess.allowedInterviews) || 0;
      const current = Number(candidate.demoAccess.completedInterviews) || 0;
      const updatedCount = current + 1;

      candidate.demoAccess.completedInterviews = updatedCount;
      candidate.markModified('demoAccess');
      await candidate.save();

      session.isDemoCounted = true;
      if (!session.userId) {
        session.userId = candidate._id;
      }
      await session.save();

      const remaining = Math.max(0, allowed - updatedCount);
      console.log(
        `[Demo Access Security] Deducted quota for ${candidate.email}: completed=${updatedCount} / allowed=${allowed} (remaining: ${remaining})`
      );

      return {
        enabled: Boolean(candidate.demoAccess.enabled),
        allowedInterviews: allowed,
        completedInterviews: updatedCount,
        remainingInterviews: remaining,
        notes: candidate.demoAccess.notes || '',
      };
    }

    return null;
  } catch (err) {
    console.error('[Demo Access Security] Error recording completed demo interview:', err.message);
    return null;
  }
};

module.exports = {
  requireInterviewDemoAccess,
  recordCompletedDemoInterview,
};
