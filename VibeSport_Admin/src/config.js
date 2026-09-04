// Khi chạy trên Vercel (Domain online), dùng relative path để Vercel Proxy chuyển tiếp (tránh lỗi Mixed Content HTTPS -> HTTP)
// Khi chạy local trên máy tính, dùng thẳng URL máy chủ VPS
const isProductionDomain = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export const SERVER_URL = isProductionDomain 
  ? '' 
  : (process.env.REACT_APP_API_URL || 'http://222.255.182.188:4000');

export const ADMIN_API_URL = `${SERVER_URL}/api/admin`;
