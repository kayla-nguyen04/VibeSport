const Groq = require('groq-sdk');
const Match = require('../models/Match');

// Khởi tạo SDK Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Ưu tiên model 70B cho chất lượng tốt, model 8B nhẹ hơn làm dự phòng
const PREFERRED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

exports.chatWithAi = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập nội dung tin nhắn.',
      });
    }

    const userQuery = prompt.trim();

    // 1. Lấy danh sách các trận đấu đang mở từ MongoDB
    const openMatches = await Match.find({
      status: 'open',
      teamStatus: { $ne: 'ended' },
    })
      .select('_id title sport date startTime locationName costPerPerson currentPlayers maxPlayers skillLevel')
      .limit(20)
      .lean();

    const matchesSummary = openMatches.map((m) => ({
      matchId: m._id.toString(),
      title: m.title,
      sport: m.sport === 'football' ? 'Bóng đá' : m.sport === 'badminton' ? 'Cầu lông' : 'Pickleball',
      date: m.date,
      startTime: m.startTime,
      location: m.locationName,
      costPerPerson: m.costPerPerson,
      players: `${m.currentPlayers}/${m.maxPlayers}`,
      skillLevel: m.skillLevel,
    }));

    const systemInstruction = `
Bạn là "VibeSport AI" - Trợ lý thể thao thông minh chuyên nghiệp của ứng dụng VibeSport.
Nhiệm vụ của bạn:
1. Giải đáp các thắc mắc về trận đấu, môn thể thao, luật chơi, thông tin thể thao thế giới một cách thân thiện, hào hứng, dùng biểu tượng cảm xúc.
2. Nếu người dùng hỏi/tìm kiếm trận đấu:
   - Đối soát câu hỏi với danh sách trận đấu bên dưới.
   - Chọn ra các trận đấu phù hợp nhất và trả về mảng "suggestedMatches".
3. Nếu người dùng nhập linh tinh hoặc không rõ mục đích:
   - Lịch sự chào hỏi và giới thiệu các tính năng bạn hỗ trợ.
4. BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON duy nhất theo cấu trúc:
{
  "replyText": "Nội dung phản hồi bằng tiếng Việt cho người dùng",
  "suggestedMatches": [
    {
      "matchId": "string",
      "title": "string",
      "sport": "string",
      "date": "string",
      "startTime": "string",
      "location": "string",
      "costPerPerson": number,
      "players": "string"
    }
  ]
}

Danh sách các trận đấu đang có trên VibeSport:
${JSON.stringify(matchesSummary, null, 2)}
`;

    let rawText = null;
    let lastError = null;

    // 2. Thử lần lượt từng model
    for (const modelName of PREFERRED_MODELS) {
      try {
        const completion = await groq.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userQuery },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        rawText = completion?.choices?.[0]?.message?.content;
        if (rawText) {
          console.log(`[AI Controller] Thành công với model: ${modelName}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI Controller] Model ${modelName} bị hạn ngạch/lỗi. Chuyển sang model tiếp theo...`);
      }
    }

    if (!rawText) {
      throw lastError || new Error('Tất cả mô hình AI đều đang bận.');
    }

    let parsedData = {};

    try {
      const cleanJsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      parsedData = {
        replyText: rawText || 'Xin lỗi, VibeSport AI chưa hiểu rõ ý bạn. Bạn có thể thử tìm theo môn thể thao hoặc địa điểm nhé!',
        suggestedMatches: [],
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        replyText: parsedData.replyText || 'Rất tiếc, tôi chưa tìm thấy thông tin phù hợp.',
        suggestedMatches: Array.isArray(parsedData.suggestedMatches) ? parsedData.suggestedMatches : [],
      },
    });
  } catch (error) {
    console.error('[AI Controller] Chat with AI error detail:', error?.message || error);

    const errorStr = String(error?.message || error);
    const isQuotaError = errorStr.includes('429') || errorStr.toLowerCase().includes('rate limit');

    const userFriendlyMessage = isQuotaError
      ? 'Hệ thống AI đang chạm giới hạn lượt hỏi miễn phí trong phút này. Bạn chờ khoảng 10-15 giây rồi bấm hỏi lại giúp mình nhé! ⚡'
      : 'Không thể kết nối với VibeSport AI lúc này. Vui lòng thử lại sau.';

    return res.status(200).json({
      success: true,
      data: {
        replyText: userFriendlyMessage,
        suggestedMatches: [],
      },
    });
  }
};