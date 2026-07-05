// ============================================
// AVATAR PALETTE - Proposal (NOT from Figma MCP)
// Dùng để random màu nền initials avatar theo tên user
// ============================================

// 8 màu sáng/vừa, contrast tốt với chữ trắng
export const avatarPalette = [
  '#FF6B3D', // Coral Orange
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#2196F3', // Blue
  '#00BCD4', // Cyan
  '#4CAF50', // Green
  '#FF9800', // Amber
];

// Hàm chọn màu theo name (deterministic hash)
export function getAvatarColor(name) {
  if (!name) return avatarPalette[0];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarPalette.length;
  return avatarPalette[index];
}
