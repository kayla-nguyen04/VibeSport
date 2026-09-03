const Post = require('../models/Post');


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


async function decrementReportCount(postId) {
  const post = await Post.findById(postId);
  if (!post) return null;

  post.reportCount = Math.max(0, (post.reportCount || 0) - 1);
  await post.save();
  return post;
}

module.exports = { incrementReportCount, decrementReportCount };
