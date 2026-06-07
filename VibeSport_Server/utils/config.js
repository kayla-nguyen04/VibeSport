const PORT = process.env.PORT || 4000;
const IP_ADDRESS = '192.168.1.8'; // Thay đổi theo IP máy của bạn khi chạy local
const API_BASE_URL = process.env.API_BASE_URL || `http://${IP_ADDRESS}:${PORT}`;

module.exports = {
  PORT,
  API_BASE_URL,
};
