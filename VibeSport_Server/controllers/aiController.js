const Groq = require('groq-sdk');
const Match = require('../models/Match');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Groq đã khai tử llama-3.3-70b-versatile, llama-3.1-8b-instant và gemma2-9b-it
// (xem https://console.groq.com/docs/deprecations). Danh sách model còn hoạt động:
const ACTIVE_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
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

    // ==========================================
    // BƯỚC 1: TRUY VẤN DỮ LIỆU TỪ MONGODB
    // ==========================================
    const openMatches = await Match.find({
      status: 'open',
      teamStatus: { $ne: 'ended' },
    })
      .select('_id title sport date startTime locationName costPerPerson currentPlayers maxPlayers skillLevel')
      .sort({ date: 1, startTime: 1 })
      .limit(15)
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

    // ==========================================
    // BƯỚC 2: THIẾT LẬP PROMPT HỆ THỐNG
    // ==========================================
    const systemInstruction = `
Bạn là "VibeSport AI" - Trợ lý thể thao thông minh của ứng dụng VibeSport.

===== THÔNG TIN HỆ SINH THÁI VIBESPORT =====
VibeSport hỗ trợ 3 môn: Bóng đá (⚽), Cầu lông (🏸), Pickleball (🏓).
Các chức năng chính:
1. TÌM & TẠO TRẬN ĐẤU: Tìm trận đấu gần vị trí hoặc tự tạo trận mới (chọn sân, giờ, số người, chi phí, trình độ). Tự động nhắc lịch trước 30 phút.
2. CÂU LẠC BỘ (FC): Tạo/quản lý đội bóng, giao lưu thách đấu.
3. BÀI VIẾT CỘNG ĐỒNG: Đăng bài tìm kèo, tìm đối thủ, like, comment, lưu bài viết.
4. GỌI THOẠI / VIDEO CALL: Nhắn tin và gọi thoại/video trực tiếp qua Agora.
5. ĐÁNH GIÁ SÂN: Tra cứu, review đánh giá chất lượng sân bãi.
===== HẾT PHẦN KIẾN THỨC VỀ APP =====

NHIỆM VỤ CỦA BẠN:
1. Câu hỏi về thể thao nói chung (luật chơi, chiến thuật, kỹ năng, tin tức...): Trả lời đầy đủ, hào hứng, dùng emoji sinh động. Mảng "suggestedMatches" để rỗng [].
2. Câu hỏi về cách dùng app: Hướng dẫn ngắn gọn, dễ hiểu dựa vào phần thông tin trên. Mảng "suggestedMatches" để rỗng [].
3. Câu hỏi tìm trận đấu: Đối soát câu hỏi với danh sách trận đấu bên dưới để chọn các trận phù hợp đưa vào mảng "suggestedMatches". Nếu không có trận nào khớp, giải thích lịch sự trong "replyText" và mảng "suggestedMatches" để rỗng [].

BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON DUY NHẤT THEO CẤU TRÚC:
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

DANH SÁCH CÁC TRẬN ĐẤU HIỆN CÓ:
${JSON.stringify(matchesSummary, null, 2)}
`;

    // ==========================================
    // BƯỚC 3: GỌI GROQ AI
    // ==========================================
    let rawText = null;
    let lastError = null;

    for (const modelName of ACTIVE_MODELS) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          model: modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userQuery },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        rawText = chatCompletion.choices[0]?.message?.content;
        if (rawText) {
          console.log(`[AI Controller] Phản hồi thành công từ model: ${modelName}`);
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[AI Controller] Thử model ${modelName} thất bại:`, err?.message || err);
      }
    }

    if (!rawText) {
      throw lastError || new Error('Không nhận được phản hồi từ các model Groq.');
    }

    // ==========================================
    // BƯỚC 4: XỬ LÝ KẾT QUẢ TRẢ VỀ
    // ==========================================
    let parsedData = {};
    try {
      const cleanJsonStr = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      console.warn('[AI Controller] Lỗi parse JSON, dùng rawText:', parseErr);
      parsedData = {
        replyText: rawText || 'Xin lỗi, VibeSport AI chưa hiểu rõ ý bạn. Bạn thử đặt lại câu hỏi nhé!',
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
    console.error('[AI Controller] Error:', error?.message || error);
    return res.status(200).json({
      success: true,
      data: {
        replyText: 'VibeSport AI đang bận một chút. Bạn vui lòng thử gửi lại câu hỏi nhé! ⚡',
        suggestedMatches: [],
      },
    });
  }
};