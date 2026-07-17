const { RtcTokenBuilder, RtcRole } = require('agora-token');
const Conversation = require('../models/Conversation');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

async function generateAgoraToken(req, res) {
  try {
    const { channelName, uid } = req.body;

    if (!channelName || uid == null) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu channelName hoặc uid.',
      });
    }

    // Parse conversationId từ channelName: call_<conversationId>
    const match = String(channelName).match(/^call_(.+)$/);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'channelName không hợp lệ.',
      });
    }
    const conversationId = match[1];

    // Xác thực: user phải là participant của conversation
    const conversation = await Conversation.findById(conversationId)
      .select('participants')
      .lean();
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy cuộc trò chuyện.',
      });
    }
    const participantIds = conversation.participants.map((p) => String(p._id || p));
    if (!participantIds.includes(String(req.userId))) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tham gia cuộc gọi này.',
      });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({
        success: false,
        message: 'Agora chưa được cấu hình phía server.',
      });
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600; // 1 giờ
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      String(channelName),
      Number(uid),
      role,
      privilegeExpiredTs
    );

    return res.json({
      success: true,
      token,
      appId: APP_ID,
      channelName: String(channelName),
      uid: Number(uid),
    });
  } catch (error) {
    console.error('[Agora] Token generation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo Agora token.',
    });
  }
}

module.exports = { generateAgoraToken };
