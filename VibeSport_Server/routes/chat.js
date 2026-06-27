const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  getMessages,
  sendMessage,
  sendImageMessage,
  markConversationRead,
  acceptConversation,
  blockConversation,
  unblockConversation,
  deleteConversation,
  muteConversation,
  unmuteConversation,
  deletePendingMessages,
  updateGroupInfo,
  addParticipants,
  leaveGroup,
  removeParticipant,
  updateMemberRole,
  muteMemberInGroup,
  unmuteMemberInGroup,
  updateNickname,
  generateInviteLink,
  revokeInviteLink,
  getInviteLinkInfo,
  joinViaInviteLink,
  approveJoinRequest,
  rejectJoinRequest,
  requestToJoinGroup,
  requestAddMember,
  pinMessage,
  unpinMessage,
  recallMessage,
} = require('../controllers/chatController');
const uploadConversation = require('../middleware/uploadConversation');

const router = express.Router();

router.use(authMiddleware);

router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
// Gửi ảnh trong chat
router.post('/conversations/:id/messages/image', uploadConversation.single('image'), sendImageMessage);
router.put('/conversations/:id/read', markConversationRead);
router.put('/conversations/:id/accept', acceptConversation);
router.put('/conversations/:id/block', blockConversation);
router.put('/conversations/:id/unblock', unblockConversation);
router.delete('/conversations/:id', deleteConversation);
router.put('/conversations/:id/mute', muteConversation);
router.put('/conversations/:id/unmute', unmuteConversation);
router.put('/conversations/:id/delete-pending', deletePendingMessages);
router.put('/conversations/:id/group-info', uploadConversation.single('avatar'), updateGroupInfo);
router.put('/conversations/:id/participants', addParticipants);
router.put('/conversations/:id/leave', leaveGroup);
router.put('/conversations/:id/remove-participant', removeParticipant);
// Group permissions
router.put('/conversations/:id/member-role', updateMemberRole);
router.put('/conversations/:id/mute-member', muteMemberInGroup);
router.put('/conversations/:id/unmute-member', unmuteMemberInGroup);
// Nicknames
router.put('/conversations/:id/nickname', updateNickname);
// Invite link
router.post('/conversations/:id/invite-link', generateInviteLink);
router.put('/conversations/:id/revoke-invite', revokeInviteLink);
router.get('/invite/:code/info', getInviteLinkInfo);
router.post('/invite/:code/join', joinViaInviteLink);
// Join requests (duyệt thành viên)
router.post('/conversations/:id/join-request', requestToJoinGroup);
router.put('/conversations/:id/approve-member', approveJoinRequest);
router.put('/conversations/:id/reject-member', rejectJoinRequest);
router.post('/conversations/:id/add-member-request', requestAddMember);
// Pinned message
router.put('/conversations/:id/pin', pinMessage);
router.put('/conversations/:id/unpin', unpinMessage);
// Recall message
router.put('/messages/:messageId/recall', recallMessage);

module.exports = router;

