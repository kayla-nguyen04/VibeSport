const AdminSession = require('../models/AdminSession');

async function requireAdmin(request, response, next) {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    response.status(401).json({ message: 'Thiếu token xác thực.' });
    return;
  }

  const session = await AdminSession.findOne({ token }).populate('adminId');

  if (!session || !session.adminId) {
    response.status(401).json({ message: 'Phiên đăng nhập không hợp lệ.' });
    return;
  }

  request.admin = session.adminId;
  next();
}

module.exports = requireAdmin;