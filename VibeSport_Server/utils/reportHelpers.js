const Post = require('../models/Post');

/**
 * Tăng reportCount trên Post và tự động chuyển sang pending_review
 * khi đạt ngưỡng >= 3 reports và status hiện tại là 'active'.
 * Dùng chung cho cả user report và admin report endpoint.
 */
async function incrementReportCount(postId) {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.reportCount = (post.reportCount || 0) + 1;
  post.lastReportedAt = new Date();

  if (post.reportCount >= 3 && post.status === 'active') {
    post.status = 'pending_review';
  }

  await post.save();
  return post;
}

/**
 * Giảm reportCount trên Post (khi admin xử lý/ignore report).
 */
async function decrementReportCount(postId) {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.reportCount = Math.max(0, (post.reportCount || 0) - 1);
  await post.save();
  return post;
}

module.exports = { incrementReportCount, decrementReportCount };
