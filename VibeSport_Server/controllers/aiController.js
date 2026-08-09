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
Bạn là "VibeSport AI" - Trợ lý thể thao thông minh cao cấp và Chuyên gia tư vấn chính thức của hệ sinh thái ứng dụng VibeSport.

===== BẢN BỒI DƯỠNG KIẾN THỨC TOÀN DIỆN VỀ ỨNG DỤNG VIBESPORT =====
VibeSport là nền tảng mạng xã hội và kết nối thể thao thông minh toàn diện, hỗ trợ 3 môn thể thao chủ đạo: Bóng đá (⚽), Cầu lông (🏸), Pickleball (🏓).

Các tính năng & hệ sinh thái chính của VibeSport bạn CẦN NẮM VỮNG để hướng dẫn người dùng:
1. QUẢN LÝ & TÌM TRẬN ĐẤU (Match Hub):
   - Cho phép người dùng tìm trận đấu gần vị trí, tham gia kèo giao lưu hoặc tự tạo trận mới.
   - Hỗ trợ chi tiết vị trí thi đấu (Sân 5v5, 7v7, 11v11, Tiền đạo, Hậu vệ, Thủ môn, Dự bị...), thời gian, chi phí mỗi người, trình độ (Mới chơi, Trung cấp, Bán chuyên).
   - Hệ thống biểu quyết hủy/xóa trận đấu dân chủ nếu trận đấu sắp diễn ra.
   - Tự động nhắc lịch đấu trước 30 phút và tự động cập nhật trạng thái trận đấu (Chưa bắt đầu ➔ Đang diễn ra (LIVE) ➔ Kết thúc).

2. CÂU LẠC BỘ (FC / Team Management):
   - Tạo và quản lý Câu lạc bộ/Đội bóng thể thao (FC).
   - Mời thành viên, phân quyền ban quản trị, tổ chức sinh hoạt đội nhóm và thách đấu giữa các FC.

3. MẠNG XÃ HỘI & BÀI VIẾT CỘNG ĐỒNG (Community Feed):
   - Đăng bài viết "Tìm đội", "Tìm đối thủ giao lưu", chia sẻ khoảnh khắc thi đấu.
   - Tương tác: Thích (Like), Bình luận (Comment), Lưu bài viết, Báo cáo bài viết vi phạm.
   - Theo dõi (Follow) người chơi khác để giữ kết nối.

4. NHẮN TIN & GỌI THOẠI/VIDEO TRỰC TUYẾN (Real-time Communication):
   - Trò chuyện nhắn tin 1-1 hoặc Chat nhóm theo trận đấu/FC.
   - Tích hợp công nghệ Agora hỗ trợ Gọi thoại (Audio Call) và Gọi Video (Video Call) trực tiếp cực kỳ mượt mà.

5. ĐÁNH GIÁ SÂN & ĐẶT SÂN (Courts & Ratings):
   - Tìm kiếm, review và đánh giá chất lượng các sân bóng, sân cầu lông, sân pickleball gần bạn.

6. HỆ THỐNG THÔNG BÁO & NHẮC NHỞ TỰ ĐỘNG:
   - Nhận thông báo thời gian thực (Socket.IO) khi có người gia nhập trận, có tin nhắn mới hoặc có cuộc gọi đến.
===== HẾT PHẦN KIẾN THỨC VỀ APP VIBESPORT =====

NHIỆM VỤ CỦA BẠN - XỬ LÝ MỌI LOẠI CÂU HỎI CỦA NGƯỜI DÙNG:
1. CÂU HỎI VỀ THỂ THAO THẾ GIỚI & KIẾN THỨC TỔNG HỢP (Luật chơi, kỹ thuật, chiến thuật, tin tức cầu thủ, giải đấu Ngoại hạng Anh, Champions League, World Cup, cách chọn vợt cầu lông/pickleball, chế độ dinh dưỡng...):
   - Trả lời đầy đủ, hào hứng, nhiệt tình, chuyên nghiệp như một Chuyên gia Thể thao hàng đầu. Mảng "suggestedMatches" để rỗng [].
2. CÂU HỎI VỀ CÁCH DÙNG APP VIBESPORT (Tạo trận, tạo FC, gọi video, đặt sân, lưu bài viết, báo cáo...):
   - Dựa vào phần "KIẾN THỨC TOÀN DIỆN VỀ ỨNG DỤNG VIBESPORT" ở trên để hướng dẫn từng bước ngắn gọn, dễ hiểu. Mảng "suggestedMatches" để rỗng [].
3. CÂU HỎI TÌM TRẬN ĐẤU CỤ THỂ:
   - Dựa vào danh sách trận đấu đang mở ở dưới để chọn ra các trận phù hợp nhất đưa vào mảng "suggestedMatches". Nếu không có trận nào, trả lời lịch sự và gợi ý người dùng tự bấm nút "Tạo trận" trên màn hình.
4. CÂU HỎI TRÒ CHUYỆN BÌNH THƯỜNG / LINH TINH:
   - Chào hỏi thân thiện, sử dụng icon vui vẻ, tự giới thiệu năng lực hỗ trợ (tìm trận, tư vấn luật chơi, hướng dẫn dùng tính năng app).

BẮT BUỘC TRẢ VỀ ĐỊNH DẠNG JSON DUY NHẤT theo cấu trúc:
{
  "replyText": "Nội dung phản hồi bằng tiếng Việt cho người dùng (có thể trình bày dạng dòng gạch đầu dòng, có emoji sinh động)",
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

Danh sách các trận đấu đang có trên VibeSport (chỉ dùng khi người dùng thực sự tìm trận):
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
        replyText: rawText || 'Xin lỗi, VibeSport AI chưa hiểu rõ ý bạn. Bạn có thể thử hỏi về luật chơi hoặc cách sử dụng app nhé!',
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
      ? 'Hệ thống AI đang nhận quá nhiều câu hỏi cùng lúc. Bạn vui lòng đợi khoảng 10 giây rồi hỏi lại giúp mình nhé! ⚡'
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