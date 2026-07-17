/**
 * Chuyển MongoDB ObjectId (dạng 24 ký tự hex) thành số nguyên int32
 * NHẤT QUÁN: cùng 1 ObjectId luôn cho cùng 1 số.
 *
 * Cách hoạt động:
 *   - Lấy 8 byte cuối của ObjectId (phần timestamp — 4 byte cuối trong phần timestamp)
 *     rồi lấy 4 byte ngẫu nhiên còn lại, ghép thành 8 byte → parse thành số nguyên.
 *   - Kết quả luôn nằm trong phạm vi int32 (|value| < 2^31) vì parseInt base-16
 *     trên JS đảm bảo độ lớn tương ứng với số hex truyền vào.
 *
 * @param {string} objectId - MongoDB ObjectId (24 ký tự hex)
 * @returns {number} - Số nguyên int32 dùng làm Agora uid
 */
export function objectIdToUid(objectId) {
  if (!objectId || typeof objectId !== 'string' || objectId.length < 24) {
    return 0;
  }
  // Lấy 8 ký tự cuối (phần cuối của ObjectId, mang tính unique cao)
  const hex = objectId.slice(-8);
  // Parse hex → số nguyên dương, đảm bảo nằm trong int32
  const uid = parseInt(hex, 16) % 2147483647;
  return uid === 0 ? 1 : uid;
}
