const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getConversations,
  getUnreadCount,
  createOrGetConversation,
  getMessages,
  sendMessage,
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
} = require('../controllers/chatController');
const uploadConversation = require('../middleware/uploadConversation');

const router = express.Router();

router.use(authMiddleware);

router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCount);
router.post('/conversations', createOrGetConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
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

module.exports = router;
