const Session = require('../models/Session');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const session = await Session.findOne({ token }).populate('userId');
    if (!session || !session.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token' });
    }

    // Attach user information to request
    req.userId = session.userId._id;
    req.user = session.userId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Server error in auth middleware' });
  }
}

module.exports = authMiddleware;
