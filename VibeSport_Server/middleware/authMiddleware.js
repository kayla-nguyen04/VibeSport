const Session = require('../models/Session');

// Middleware xác thực Token đăng nhập của VibeSport
exports.authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Không tìm thấy token xác thực.' });
    }

    const token = authHeader.split(' ')[1];
    const session = await Session.findOne({ token }).populate('userId');

    if (!session || !session.userId) {
      return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }

    // Gán thông tin người dùng vào request
    req.user = session.userId;
    next();
  } catch (error) {
    console.error('[authMiddleware] Lỗi xác thực:', error);
    return res.status(500).json({ message: 'Lỗi xác thực máy chủ.' });
  }
};  