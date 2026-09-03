const PORT = process.env.PORT || 4000;
const IP_ADDRESS = process.env.IP_ADDRESS || "192.168.1.141";
const API_BASE_URL = process.env.API_BASE_URL || `http://${IP_ADDRESS}:${PORT}`;

module.exports = {
  PORT,
  API_BASE_URL,
};
