const User = require('../models/User');
const { extractToken, verifySessionToken } = require('../config/authToken');

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const decoded = verifySessionToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

// Attaches req.user when a valid token is present, but never blocks the request
const optionalProtect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const decoded = verifySessionToken(token);
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    }
  } catch {
    // Invalid tokens are treated as anonymous
  }
  next();
};

const isAdminUser = (user) => Boolean(user && user.role === 'admin');

const requireAdmin = (req, res, next) => {
  if (isAdminUser(req.user)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required',
    });
  }
};

module.exports = { protect, optionalProtect, requireAdmin, isAdminUser };
