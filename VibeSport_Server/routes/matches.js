const express = require("express");
const Match = require("../models/Match");
const Notification = require("../models/Notification");
const User = require("../models/User");

const router = express.Router();

const populateFields = [
  { path: "createdBy", select: "name email picture area favoriteSport position" },
  { path: "participants", select: "name email picture area favoriteSport" },
  { path: "pendingJoinRequests", select: "name email picture area favoriteSport" },
];

router.post("/", async (req, res) => {
  try {
    const {
      sport,
      title,
      date,
      startTime,
      maxPlayers,
      positionsNeeded,
      costPerPerson,
      locationName,
      location,
      note,
      createdBy,
      selectedPositionIds,
      benchMembersTeam1,
      benchMembersTeam2,
    } = req.body;

    if (!sport || !title || !date || !startTime || !maxPlayers || !locationName) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    if (!["football", "badminton", "pickleball"].includes(sport)) {
      return res.status(400).json({
        success: false,
        message: "Môn thể thao không hợp lệ",
      });
    }

    if (Number(maxPlayers) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Số người tối đa phải lớn hơn 0",
      });
    }

    const match = await Match.create({
      sport,
      title,
      date,
      startTime,
      maxPlayers: Number(maxPlayers),
      positionsNeeded: sport === "football" ? positionsNeeded || [] : [],
      selectedPositionIds: sport === "football" ? selectedPositionIds || [] : [],
      benchMembersTeam1: sport === "football" ? Number(benchMembersTeam1 || 0) : 0,
      benchMembersTeam2: sport === "football" ? Number(benchMembersTeam2 || 0) : 0,
      costPerPerson: Number(costPerPerson || 0),
      locationName,
      location: location || {},
      note: note || "",
      createdBy: createdBy || undefined,
      participants: createdBy ? [createdBy] : [],
      currentPlayers: createdBy ? 1 : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo trận đấu thành công",
      data: match,
    });
  } catch (error) {
    console.error("Create match error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo trận đấu",
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const { sport, q, area, startTime, createdBy } = req.query;

    const filter = {};

    if (sport) {
      filter.sport = sport;
    }

    if (createdBy && String(createdBy).trim()) {
      filter.createdBy = String(createdBy).trim();
    }

    // Search by keyword (title or locationName)
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [
        { title: regex },
        { locationName: regex },
        { "location.address": regex },
      ];
    }

    // Filter by area (locationName contains area string)
    if (area && area.trim()) {
      const areaRegex = new RegExp(area.trim(), "i");
      // If $or already exists from keyword search, wrap in $and
      if (filter.$or) {
        filter.$and = [
          { $or: filter.$or },
          { $or: [{ locationName: areaRegex }, { "location.address": areaRegex }] },
        ];
        delete filter.$or;
      } else {
        filter.$or = [{ locationName: areaRegex }, { "location.address": areaRegex }];
      }
    }

    // Filter by startTime (exact match e.g. "19:00")
    if (startTime && startTime.trim()) {
      filter.startTime = startTime.trim();
    }

    const matches = await Match.find(filter)
      .sort({ createdAt: -1 })
      .populate(populateFields);

    return res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error("Get matches error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách trận đấu",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const match = await Match.findById(req.params.id).populate(populateFields);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy trận đấu",
      });
    }

    return res.json({
      success: true,
      data: match,
    });
  } catch (error) {
    console.error("Get match detail error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy chi tiết trận đấu",
    });
  }
});

// Join a match
router.post("/:id/join", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    if (match.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: "Bạn đã tham gia trận đấu này rồi" });
    }

    if (match.participants.length >= match.maxPlayers) {
      return res.status(400).json({ success: false, message: "Trận đấu đã đầy người" });
    }

    match.participants.push(userId);
    match.currentPlayers = match.participants.length;
    if (match.currentPlayers >= match.maxPlayers) {
      match.status = "full";
    }
    await match.save();

    return res.json({ success: true, message: "Tham gia trận đấu thành công", data: match });
  } catch (error) {
    console.error("Join match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi tham gia trận" });
  }
});

// Leave / Withdraw from a match
router.post("/:id/leave", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    const index = match.participants.indexOf(userId);
    if (index === -1) {
      return res.status(400).json({ success: false, message: "Bạn chưa tham gia trận đấu này" });
    }

    match.participants.splice(index, 1);
    match.currentPlayers = match.participants.length;
    if (match.currentPlayers < match.maxPlayers && match.status === "full") {
      match.status = "open";
    }
    await match.save();

    return res.json({ success: true, message: "Rút khỏi trận đấu thành công", data: match });
  } catch (error) {
    console.error("Leave match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi rút khỏi trận" });
  }
});

// Update a match
router.put("/:id", async (req, res) => {
  try {
    const {
      sport,
      title,
      date,
      startTime,
      maxPlayers,
      positionsNeeded,
      costPerPerson,
      locationName,
      location,
      note,
      selectedPositionIds,
      benchMembersTeam1,
      benchMembersTeam2,
    } = req.body;

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    if (sport && !["football", "badminton", "pickleball"].includes(sport)) {
      return res.status(400).json({ success: false, message: "Môn thể thao không hợp lệ" });
    }

    if (maxPlayers !== undefined) {
      const nextMax = Number(maxPlayers);
      if (nextMax <= 0) {
        return res.status(400).json({ success: false, message: "Số người tối đa phải lớn hơn 0" });
      }
      if (nextMax < match.participants.length) {
        return res.status(400).json({
          success: false,
          message: "Số người tối đa không thể nhỏ hơn số người đã tham gia",
        });
      }
      match.maxPlayers = nextMax;
      if (match.participants.length >= nextMax) {
        match.status = "full";
      } else if (match.status === "full") {
        match.status = "open";
      }
    }

    if (sport) match.sport = sport;
    if (title) match.title = title.trim();
    if (date) match.date = date;
    if (startTime) match.startTime = startTime;
    if (positionsNeeded !== undefined) {
      match.positionsNeeded = sport === "football" || match.sport === "football" ? positionsNeeded || [] : [];
    }
    if (selectedPositionIds !== undefined) {
      match.selectedPositionIds = sport === "football" || match.sport === "football" ? selectedPositionIds || [] : [];
    }
    if (benchMembersTeam1 !== undefined) {
      match.benchMembersTeam1 = sport === "football" || match.sport === "football" ? Number(benchMembersTeam1 || 0) : 0;
    }
    if (benchMembersTeam2 !== undefined) {
      match.benchMembersTeam2 = sport === "football" || match.sport === "football" ? Number(benchMembersTeam2 || 0) : 0;
    }
    if (costPerPerson !== undefined) match.costPerPerson = Number(costPerPerson || 0);
    if (locationName) match.locationName = locationName.trim();
    if (location) match.location = location;
    if (note !== undefined) match.note = note;

    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);

    return res.json({
      success: true,
      message: "Cập nhật trận đấu thành công",
      data: updated,
    });
  } catch (error) {
    console.error("Update match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi cập nhật trận đấu" });
  }
});

// Delete a match
router.delete("/:id", async (req, res) => {
  try {
    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    return res.json({ success: true, message: "Xóa trận đấu thành công" });
  } catch (error) {
    console.error("Delete match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi xóa trận đấu" });
  }
});

// Request to join a match (sends notification to owner)
router.post("/:id/request-join", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    const creatorId = String(match.createdBy || "");
    if (creatorId === String(userId)) {
      return res.status(400).json({ success: false, message: "Bạn là người tạo trận này" });
    }

    if (match.participants.some((p) => String(p) === String(userId))) {
      return res.status(400).json({ success: false, message: "Bạn đã tham gia trận đấu này rồi" });
    }

    if (match.pendingJoinRequests.some((p) => String(p) === String(userId))) {
      return res.status(400).json({ success: false, message: "Bạn đã gửi yêu cầu tham gia rồi" });
    }

    if (match.participants.length >= match.maxPlayers) {
      return res.status(400).json({ success: false, message: "Trận đấu đã đầy người" });
    }

    match.pendingJoinRequests.push(userId);
    await match.save();

    const requester = await User.findById(userId).select("name");
    const requesterName = requester?.name || "Một người dùng";

    if (match.createdBy) {
      await Notification.create({
        userId: match.createdBy,
        type: "match",
        fromUserId: userId,
        message: `${requesterName} muốn tham gia trận "${match.title}"`,
      });
    }

    const updated = await Match.findById(match._id).populate(populateFields);

    return res.json({
      success: true,
      message: "Đã gửi yêu cầu tham gia đến chủ trận",
      data: updated,
    });
  } catch (error) {
    console.error("Request join match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi gửi yêu cầu tham gia" });
  }
});

// Cancel a join request
router.post("/:id/cancel-request", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    // Remove user from pendingJoinRequests
    match.pendingJoinRequests = match.pendingJoinRequests.filter(
      (p) => String(p) !== String(userId)
    );
    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);

    return res.json({
      success: true,
      message: "Đã hủy yêu cầu tham gia thành công",
      data: updated,
    });
  } catch (error) {
    console.error("Cancel request join match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi hủy yêu cầu tham gia" });
  }
});

// Accept a join request (owner only)
router.post("/:id/accept-join", async (req, res) => {
  try {
    const { ownerId, userId } = req.body;
    if (!ownerId || !userId) {
      return res.status(400).json({ success: false, message: "Thiếu ownerId hoặc userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    if (String(match.createdBy) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ trận mới có thể chấp nhận yêu cầu" });
    }

    const requestIndex = match.pendingJoinRequests.findIndex((p) => String(p) === String(userId));
    if (requestIndex === -1) {
      return res.status(400).json({ success: false, message: "Không tìm thấy yêu cầu tham gia" });
    }

    if (match.participants.some((p) => String(p) === String(userId))) {
      match.pendingJoinRequests.splice(requestIndex, 1);
      await match.save();
      return res.status(400).json({ success: false, message: "Người dùng đã tham gia trận này" });
    }

    if (match.participants.length >= match.maxPlayers) {
      return res.status(400).json({ success: false, message: "Trận đấu đã đầy người" });
    }

    match.pendingJoinRequests.splice(requestIndex, 1);
    match.participants.push(userId);
    match.currentPlayers = match.participants.length;
    if (match.currentPlayers >= match.maxPlayers) {
      match.status = "full";
    }
    await match.save();

    const owner = await User.findById(ownerId).select("name");
    await Notification.create({
      userId,
      type: "match",
      fromUserId: ownerId,
      message: `${owner?.name || "Chủ trận"} đã chấp nhận yêu cầu tham gia trận "${match.title}"`,
    });

    const updated = await Match.findById(match._id).populate(populateFields);

    return res.json({
      success: true,
      message: "Đã chấp nhận yêu cầu tham gia",
      data: updated,
    });
  } catch (error) {
    console.error("Accept join match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi chấp nhận yêu cầu" });
  }
});

// Reject a join request (owner only)
router.post("/:id/reject-join", async (req, res) => {
  try {
    const { ownerId, userId } = req.body;
    if (!ownerId || !userId) {
      return res.status(400).json({ success: false, message: "Thiếu ownerId hoặc userId" });
    }

    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    if (String(match.createdBy) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ trận mới có thể từ chối yêu cầu" });
    }

    const requestIndex = match.pendingJoinRequests.findIndex((p) => String(p) === String(userId));
    if (requestIndex === -1) {
      return res.status(400).json({ success: false, message: "Không tìm thấy yêu cầu tham gia" });
    }

    match.pendingJoinRequests.splice(requestIndex, 1);
    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);

    return res.json({
      success: true,
      message: "Đã từ chối yêu cầu tham gia",
      data: updated,
    });
  } catch (error) {
    console.error("Reject join match error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi từ chối yêu cầu" });
  }
});

module.exports = router;