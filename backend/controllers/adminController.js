const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const { sendDemoAccessGrantedEmail, sendDemoAccessRevokedEmail } = require('../services/emailService');
const realtimeService = require('../services/realtimeService');

/**
 * Get all demo accounts, candidate members, and platform demo metrics.
 * GET /api/admin/demo-accounts
 */
const getDemoAccounts = async (req, res) => {
  try {
    const allUsers = await User.find({ role: { $ne: 'admin' } })
      .select('-twoFactorSecret')
      .sort({ createdAt: -1 });

    const demoUsers = allUsers.filter(
      (u) => u.demoAccess?.enabled || (u.demoAccess?.allowedInterviews || 0) > 0
    );

    const eligibleCandidates = allUsers.map((u) => ({
      _id: u._id,
      id: u._id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      avatarUrl: u.avatarUrl,
      careerStage: u.careerStage || 'Candidate',
      field: u.field || 'Software Engineering',
      tier: u.tier || 'FREE',
      hasDemoAccess: Boolean(u.demoAccess?.enabled),
      allowedInterviews: u.demoAccess?.allowedInterviews || 0,
      completedInterviews: u.demoAccess?.completedInterviews || 0,
      createdAt: u.createdAt,
    }));

    // Calculate aggregated metrics
    const activeDemoCount = demoUsers.filter(
      (u) => u.demoAccess?.enabled && (u.demoAccess?.completedInterviews || 0) < (u.demoAccess?.allowedInterviews || 0)
    ).length;

    const quotaReachedCount = demoUsers.filter(
      (u) => u.demoAccess?.enabled && (u.demoAccess?.completedInterviews || 0) >= (u.demoAccess?.allowedInterviews || 0)
    ).length;

    const cancelledCount = demoUsers.filter((u) => !u.demoAccess?.enabled).length;

    const totalAllowedQuota = demoUsers.reduce(
      (sum, u) => sum + (u.demoAccess?.enabled ? Number(u.demoAccess?.allowedInterviews || 0) : 0),
      0
    );

    const totalCompletedInterviews = demoUsers.reduce(
      (sum, u) => sum + Number(u.demoAccess?.completedInterviews || 0),
      0
    );

    const formattedDemoList = demoUsers.map((u) => {
      const allowed = Number(u.demoAccess?.allowedInterviews) || 0;
      const completed = Number(u.demoAccess?.completedInterviews) || 0;
      const remaining = Math.max(0, allowed - completed);

      let status = 'Inactive';
      if (u.demoAccess?.enabled) {
        status = completed >= allowed ? 'Quota Reached' : 'Active';
      } else {
        status = 'Revoked';
      }

      return {
        _id: u._id,
        id: u._id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        field: u.field || 'Engineering',
        careerStage: u.careerStage || 'Candidate',
        demoStatus: status,
        enabled: Boolean(u.demoAccess?.enabled),
        allowedInterviews: allowed,
        completedInterviews: completed,
        remainingInterviews: remaining,
        grantedAt: u.demoAccess?.grantedAt,
        lastRefreshedAt: u.demoAccess?.lastRefreshedAt,
        notes: u.demoAccess?.notes || '',
        joinedDate: u.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      stats: {
        activeDemoCount,
        quotaReachedCount,
        cancelledCount,
        totalDemoAccounts: demoUsers.length,
        totalAllowedQuota,
        totalCompletedInterviews,
        totalCandidates: allUsers.length,
      },
      demoAccounts: formattedDemoList,
      eligibleCandidates,
    });
  } catch (error) {
    console.error('[Admin Controller] Error fetching demo accounts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve demo accounts data',
      error: error.message,
    });
  }
};

/**
 * Grant or configure Demo Interview Access for a specific member.
 * POST /api/admin/demo-accounts/grant
 */
const grantDemoAccess = async (req, res) => {
  try {
    const { userId, allowedInterviews = 3, notes = '' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Candidate user ID is required' });
    }

    const quota = Math.max(1, parseInt(allowedInterviews, 10) || 1);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate user not found' });
    }

    if (!user.demoAccess) {
      user.demoAccess = {};
    }

    user.demoAccess.enabled = true;
    user.demoAccess.allowedInterviews = quota;
    user.demoAccess.completedInterviews = 0; // Fresh initialization on new grant
    user.demoAccess.grantedAt = new Date();
    user.demoAccess.lastRefreshedAt = new Date();
    user.demoAccess.notes = notes.trim() || `Demo access granted with ${quota} mock interview attempt(s).`;

    await user.save();

    // Notify candidate dashboard in real-time via Server-Sent Events
    realtimeService.notifyUser(user._id.toString(), 'demo_access_changed', {
      userId: user._id.toString(),
      action: 'grant',
      demoAccess: {
        enabled: true,
        allowedInterviews: quota,
        completedInterviews: 0,
        remainingInterviews: quota,
        notes: user.demoAccess.notes,
      },
    });

    // Send demo access notification email to candidate with deployed link
    sendDemoAccessGrantedEmail(
      user.email,
      user.firstName,
      quota,
      user.demoAccess.notes,
      false
    ).catch((emailErr) => {
      console.error('[Admin Controller] Error sending demo access granted email:', emailErr.message);
    });

    return res.status(200).json({
      success: true,
      message: `Demo access granted to ${user.firstName} ${user.lastName} with ${quota} interview attempt(s).`,
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        demoAccess: user.demoAccess,
      },
    });
  } catch (error) {
    console.error('[Admin Controller] Error granting demo access:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to grant demo access',
      error: error.message,
    });
  }
};

/**
 * Refresh interview attempts count or update quota for an existing demo user.
 * POST /api/admin/demo-accounts/refresh
 */
const refreshDemoQuota = async (req, res) => {
  try {
    const { userId, resetCount = true, newAllowedInterviews, additionalInterviews } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate user not found' });
    }

    if (!user.demoAccess) {
      user.demoAccess = { enabled: true, allowedInterviews: 3, completedInterviews: 0 };
    }

    user.demoAccess.enabled = true;

    if (resetCount) {
      user.demoAccess.completedInterviews = 0;
    }

    if (newAllowedInterviews !== undefined && !isNaN(parseInt(newAllowedInterviews, 10))) {
      user.demoAccess.allowedInterviews = Math.max(1, parseInt(newAllowedInterviews, 10));
    } else if (additionalInterviews && !isNaN(parseInt(additionalInterviews, 10))) {
      user.demoAccess.allowedInterviews =
        (user.demoAccess.allowedInterviews || 0) + parseInt(additionalInterviews, 10);
    }

    user.demoAccess.lastRefreshedAt = new Date();
    await user.save();

    const allowed = user.demoAccess.allowedInterviews;
    const completed = user.demoAccess.completedInterviews;
    const remaining = Math.max(0, allowed - completed);

    // Notify candidate dashboard in real-time via Server-Sent Events
    realtimeService.notifyUser(user._id.toString(), 'demo_access_changed', {
      userId: user._id.toString(),
      action: 'refresh',
      demoAccess: {
        enabled: true,
        allowedInterviews: allowed,
        completedInterviews: completed,
        remainingInterviews: remaining,
        notes: user.demoAccess.notes,
      },
    });

    // Send quota refreshed notification email to candidate with deployed link
    sendDemoAccessGrantedEmail(
      user.email,
      user.firstName,
      user.demoAccess.allowedInterviews,
      'Your demo interview quota has been refreshed by an administrator.',
      true
    ).catch((emailErr) => {
      console.error('[Admin Controller] Error sending demo quota refreshed email:', emailErr.message);
    });

    return res.status(200).json({
      success: true,
      message: `Demo quota refreshed for ${user.firstName} ${user.lastName}. Allowed: ${allowed}, Completed: ${completed} (Remaining: ${remaining}).`,
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        demoAccess: user.demoAccess,
      },
    });
  } catch (error) {
    console.error('[Admin Controller] Error refreshing demo quota:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to refresh demo quota',
      error: error.message,
    });
  }
};

/**
 * Cancel or revoke demo access for a user.
 * POST /api/admin/demo-accounts/cancel
 */
const cancelDemoAccess = async (req, res) => {
  try {
    const { userId, reason = 'Cancelled by administrator' } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate user not found' });
    }

    if (!user.demoAccess) {
      user.demoAccess = {};
    }

    user.demoAccess.enabled = false;
    user.demoAccess.notes = `${user.demoAccess.notes || ''} [Cancelled on ${new Date().toLocaleDateString()}: ${reason}]`.trim();

    await user.save();

    // Notify candidate dashboard in real-time via Server-Sent Events
    realtimeService.notifyUser(user._id.toString(), 'demo_access_changed', {
      userId: user._id.toString(),
      action: 'cancel',
      demoAccess: {
        enabled: false,
        allowedInterviews: Number(user.demoAccess?.allowedInterviews) || 0,
        completedInterviews: Number(user.demoAccess?.completedInterviews) || 0,
        remainingInterviews: 0,
        notes: user.demoAccess?.notes,
      },
    });

    // Send demo access revoked notification email to candidate
    sendDemoAccessRevokedEmail(
      user.email,
      user.firstName,
      reason
    ).catch((emailErr) => {
      console.error('[Admin Controller] Error sending demo access revoked email:', emailErr.message);
    });

    return res.status(200).json({
      success: true,
      message: `Demo interview access cancelled for ${user.firstName} ${user.lastName}. User is now blocked from AI Mock Interview.`,
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        demoAccess: user.demoAccess,
      },
    });
  } catch (error) {
    console.error('[Admin Controller] Error cancelling demo access:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel demo access',
      error: error.message,
    });
  }
};

/**
 * Fetch all registered users for the Admin Users management table.
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;

    const query = {};
    if (role && role !== 'All') {
      query.role = role.toLowerCase();
    }
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-twoFactorSecret')
      .sort({ createdAt: -1 });

    // Fetch interview sessions for these users to extract counts and recent activity
    const userIds = users.map((u) => u._id);
    const sessions = await InterviewSession.find({ userId: { $in: userIds } })
      .select('userId sessionId status targetRole company evaluation createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    const userSessionMap = {};
    sessions.forEach((s) => {
      const uid = s.userId?.toString();
      if (!uid) return;
      if (!userSessionMap[uid]) {
        userSessionMap[uid] = { total: 0, completed: 0, recent: [], latestDate: null };
      }
      userSessionMap[uid].total += 1;
      const isDone = s.status === 'completed' || s.status === 'ended_by_user';
      if (isDone) {
        userSessionMap[uid].completed += 1;
      }
      if (!userSessionMap[uid].latestDate || new Date(s.createdAt) > new Date(userSessionMap[uid].latestDate)) {
        userSessionMap[uid].latestDate = s.createdAt;
      }
      if (userSessionMap[uid].recent.length < 4) {
        const rawScore = s.evaluation?.overallScore ?? s.evaluation?.score ?? 0;
        userSessionMap[uid].recent.push({
          id: s._id,
          sessionId: s.sessionId,
          role: s.targetRole || 'Software Engineer',
          company: s.company || 'Practice Mock',
          score: typeof rawScore === 'number' ? Math.round(rawScore) : 0,
          status: isDone ? 'Completed' : (s.status === 'in_progress' ? 'In Progress' : 'Planned'),
          date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        });
      }
    });

    let totalUsers = users.length;
    let demoUsers = 0;
    let activeUsers = 0;
    let inactiveUsers = 0;

    const formatted = users.map((u) => {
      const uid = u._id.toString();
      const sessionInfo = userSessionMap[uid] || { total: 0, completed: 0, recent: [], latestDate: null };
      const demo = u.demoAccess || {};
      const isDemo = Boolean(demo.enabled);
      if (isDemo) demoUsers++;

      // Relative last active string calculation
      let lastActiveStr = 'Never';
      const lastActivityDate = sessionInfo.latestDate || u.updatedAt || u.createdAt;
      if (lastActivityDate) {
        const diffMs = Date.now() - new Date(lastActivityDate).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        if (diffMins < 5) lastActiveStr = 'Just now';
        else if (diffMins < 60) lastActiveStr = `${diffMins} mins ago`;
        else if (diffHours < 24) lastActiveStr = `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
        else if (diffDays === 1) lastActiveStr = 'Yesterday';
        else if (diffDays < 30) lastActiveStr = `${diffDays} days ago`;
        else lastActiveStr = new Date(lastActivityDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      const isActive = sessionInfo.total > 0 || isDemo || Boolean(u.isProfileSetupCompleted) || Boolean(u.isVerified);
      if (isActive) activeUsers++;
      else inactiveUsers++;

      const demoRemaining = Math.max(0, (Number(demo.allowedInterviews) || 0) - (Number(demo.completedInterviews) || 0));

      let demoStatusText = 'Standard Access (Candidate Free)';
      if (isDemo) {
        demoStatusText = `Active Demo (${demoRemaining} remaining / ${demo.allowedInterviews} total allowed)`;
      } else if (u.tier === 'PRO') {
        demoStatusText = 'Candidate Pro Access';
      }

      return {
        _id: u._id,
        id: u._id.toString(),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'HireMind Candidate',
        firstName: u.firstName || '',
        lastName: u.lastName || '',
        email: u.email,
        avatar: (u.firstName ? u.firstName.charAt(0) : 'U').toUpperCase(),
        avatarUrl: u.avatarUrl || '',
        accountType: isDemo ? 'Demo' : 'Regular',
        status: isActive ? 'Active' : 'Inactive',
        role: u.role || 'user',
        isVerified: Boolean(u.isVerified),
        tier: u.tier || 'FREE',
        careerStage: u.careerStage || 'Candidate',
        field: u.field || 'Engineering',
        skills: u.skills || [],
        title: u.title || '',
        resumeUrl: u.resumeUrl || '',
        resumeFileName: u.resumeFileName || '',
        interviewsCount: sessionInfo.total,
        completedInterviews: sessionInfo.completed,
        joinedDate: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : 'N/A',
        lastActive: lastActiveStr,
        demoStatus: demoStatusText,
        demoAccess: {
          enabled: isDemo,
          allowedInterviews: Number(demo.allowedInterviews) || 0,
          completedInterviews: Number(demo.completedInterviews) || 0,
          remaining: demoRemaining,
          notes: demo.notes || '',
          grantedAt: demo.grantedAt || null,
        },
        recentInterviews: sessionInfo.recent,
      };
    });

    return res.status(200).json({
      success: true,
      users: formatted,
      stats: {
        totalUsers,
        activeUsers,
        demoUsers,
        inactiveUsers,
      },
      totalCount: formatted.length,
    });
  } catch (error) {
    console.error('[Admin Controller] Error fetching all users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message,
    });
  }
};

module.exports = {
  getDemoAccounts,
  grantDemoAccess,
  refreshDemoQuota,
  cancelDemoAccess,
  getAllUsers,
};
