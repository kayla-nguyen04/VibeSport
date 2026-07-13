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

const getPositionLabel = (posId) => {
  if (!posId) return "";
  if (posId.includes("bench")) return "Dự bị";
  if (posId.endsWith("gk")) return "Thủ môn";
  if (posId.endsWith("st")) return "Tiền đạo";
  if (posId.endsWith("lb") || posId.includes("cb") || posId.endsWith("rb")) return "Hậu vệ";
  if (posId.includes("dm") || posId.endsWith("lm") || posId.includes("am") || posId.endsWith("rm")) return "Tiền vệ";
  return "";
};

router.post("/", async (req, res) => {
  try {
    const {
      sport,
      formation,
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
      footballFormation,
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

    const defaultFormation = {
      football: "11v11",
      badminton: "2v2",
      pickleball: "2v2",
    };

    const match = await Match.create({
      sport,
      formation: formation || defaultFormation[sport],
      title,
      date,
      startTime,
      maxPlayers: Number(maxPlayers),
      positionsNeeded: sport === "football" ? positionsNeeded || [] : [],
      selectedPositionIds: sport === "football" ? selectedPositionIds || [] : [],
      benchMembersTeam1: sport === "football" ? Number(benchMembersTeam1 || 0) : 0,
      benchMembersTeam2: sport === "football" ? Number(benchMembersTeam2 || 0) : 0,
      footballFormation: sport === "football" ? footballFormation || "" : "",
      costPerPerson: Number(costPerPerson || 0),
      locationName,
      location: location || {},
      note: note || "",
      createdBy: createdBy || undefined,
      participants: createdBy ? [createdBy] : [],
      currentPlayers: createdBy ? 1 : 0,
      memberRoles: createdBy ? [{ userId: createdBy, role: "owner" }] : [],
      memberPositions: createdBy ? [{ userId: createdBy, positionId: "" }] : [],
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
    // Clean up member positions and roles
    if (match.memberPositions) {
      match.memberPositions = match.memberPositions.filter((mp) => String(mp.userId) !== String(userId));
    }
    if (match.memberRoles) {
      match.memberRoles = match.memberRoles.filter((mr) => String(mr.userId) !== String(userId));
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
      footballFormation,
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
    if (formation !== undefined) match.formation = formation;
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
    if (footballFormation !== undefined) {
      match.footballFormation = sport === "football" || match.sport === "football" ? footballFormation || "" : "";
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
    const { userId, selectedPositionIds } = req.body;
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
    if (Array.isArray(selectedPositionIds) && selectedPositionIds.length > 0) {
      // Check if user selected two positions with the same label/role in the same team
      const team1Labels = [];
      const team2Labels = [];
      for (const posId of selectedPositionIds) {
        const isTeam1 = posId.startsWith("t1_");
        const label = getPositionLabel(posId);
        if (label) {
          if (isTeam1) {
            if (team1Labels.includes(label)) {
              return res.status(400).json({ success: false, message: `Không được chọn 2 vị trí ${label} trong Đội 1` });
            }
            team1Labels.push(label);
          } else {
            if (team2Labels.includes(label)) {
              return res.status(400).json({ success: false, message: `Không được chọn 2 vị trí ${label} trong Đội 2` });
            }
            team2Labels.push(label);
          }
        }
      }

      // Find occupied positions by active participants
      const occupiedPositions = (match.memberPositions || [])
        .filter((mp) => match.participants.some((p) => String(p) === String(mp.userId)) && mp.positionId)
        .map((mp) => mp.positionId);

      // Find pending requested positions from other pending users
      const pendingPositions = [];
      (match.pendingJoinRequestPositions || []).forEach((entry) => {
        const isStillPending = match.pendingJoinRequests.some((p) => String(p) === String(entry.userId));
        if (isStillPending && String(entry.userId) !== String(userId)) {
          if (Array.isArray(entry.positionIds)) {
            pendingPositions.push(...entry.positionIds);
          }
        }
      });

      // Check if any of selectedPositionIds is already occupied or pending
      for (const posId of selectedPositionIds) {
        if (occupiedPositions.includes(posId)) {
          return res.status(400).json({ success: false, message: `Vị trí đã có người tham gia` });
        }
        if (pendingPositions.includes(posId)) {
          return res.status(400).json({ success: false, message: `Vị trí đã có người đăng ký` });
        }
      }
    }

    match.pendingJoinRequests.push(userId);
    if (Array.isArray(selectedPositionIds) && selectedPositionIds.length > 0) {
      match.pendingJoinRequestPositions = match.pendingJoinRequestPositions || [];
      match.pendingJoinRequestPositions.push({
        userId,
        positionIds: selectedPositionIds,
      });
    }
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
    match.pendingJoinRequestPositions = (match.pendingJoinRequestPositions || []).filter(
      (entry) => String(entry.userId) !== String(userId)
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
    match.pendingJoinRequestPositions = (match.pendingJoinRequestPositions || []).filter(
      (entry) => String(entry.userId) !== String(userId)
    );
    match.participants.push(userId);
    match.currentPlayers = match.participants.length;
    if (match.currentPlayers >= match.maxPlayers) {
      match.status = "full";
    }
    if (!match.memberRoles) match.memberRoles = [];
    if (!match.memberRoles.some((r) => String(r.userId) === String(userId))) {
      match.memberRoles.push({ userId, role: "member" });
    }
    if (!match.memberPositions) match.memberPositions = [];
    const reqPosEntry = (match.pendingJoinRequestPositions || []).find(
      (entry) => String(entry.userId) === String(userId)
    );
    const positionToAssign = reqPosEntry && reqPosEntry.positionIds && reqPosEntry.positionIds.length > 0
      ? reqPosEntry.positionIds[0]
      : "";

    const existingPosIndex = match.memberPositions.findIndex((p) => String(p.userId) === String(userId));
    if (existingPosIndex > -1) {
      match.memberPositions[existingPosIndex].positionId = positionToAssign;
    } else {
      match.memberPositions.push({ userId, positionId: positionToAssign });
    }

    // Clean up this user's entry from pendingJoinRequestPositions
    match.pendingJoinRequestPositions = (match.pendingJoinRequestPositions || []).filter(
      (entry) => String(entry.userId) !== String(userId)
    );
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
    match.pendingJoinRequestPositions = (match.pendingJoinRequestPositions || []).filter(
      (entry) => String(entry.userId) !== String(userId)
    );
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

// Update team status (Bắt đầu, Tạm dừng, Kết thúc)
router.post("/:id/team-status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["not_started", "ongoing", "paused", "ended"].includes(status)) {
      return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
    }
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    match.teamStatus = status;
    // Sync match status if it is ended
    if (status === "ended") {
      match.status = "completed";
    }
    await match.save();
    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Cập nhật trạng thái thành công", data: updated });
  } catch (error) {
    console.error("Update team status error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Kick member
router.post("/:id/kick-member", async (req, res) => {
  try {
    const { ownerId, userId, reason } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    // Kiểm tra quyền chủ đội
    const ownerEntry = Array.isArray(match.memberRoles)
      ? match.memberRoles.find((entry) => entry?.role === "owner")
      : null;
    const actualOwnerId = ownerEntry?.userId || match.createdBy;
    if (!ownerId || String(ownerId) !== String(actualOwnerId)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội mới có quyền thực hiện" });
    }
    // Remove user from participants
    match.participants = match.participants.filter((p) => String(p) !== String(userId));
    match.currentPlayers = match.participants.length;
    if (match.status === "full" && match.currentPlayers < match.maxPlayers) {
      match.status = "open";
    }
    
    // Remove from memberRoles and memberPositions
    if (match.memberRoles) {
      match.memberRoles = match.memberRoles.filter((r) => String(r.userId) !== String(userId));
    }
    if (match.memberPositions) {
      match.memberPositions = match.memberPositions.filter((p) => String(p.userId) !== String(userId));
    }
    await match.save();

    // Create notification for kicked user
    try {
      await Notification.create({
        userId,
        type: "match",
        message: `Bạn đã bị kích khỏi đội "${match.title}"${reason ? `. Lý do: ${reason}` : ""}`,
      });
    } catch (notifErr) {
      console.error("Create notification error:", notifErr);
    }

    // Emit socket event thông báo realtime cho user bị kick
    try { global.io.to(String(userId)).emit('team-member-kicked', { matchId: match._id }); } catch(e) {}

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Đã kích thành viên khỏi đội", data: updated });
  } catch (error) {
    console.error("Kick member error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Invite member (owner invite can be accepted directly; member invite needs owner approval)
router.post("/:id/invite-member", async (req, res) => {
  try {
    const { ownerId, userId, inviterId } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    const ownerEntry = Array.isArray(match.memberRoles)
      ? match.memberRoles.find((entry) => entry?.role === "owner")
      : null;
    const actualOwnerId = ownerEntry?.userId || match.createdBy;
    const inviter = inviterId || ownerId;
    const isOwnerInvite = String(inviter) === String(actualOwnerId);

    if (!inviter || String(inviter) !== String(actualOwnerId) && String(inviter) !== String(userId) && String(inviter) !== String(match.createdBy)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội hoặc thành viên trong đội mới có quyền mời" });
    }

    if (match.participants.some((p) => String(p) === String(userId))) {
      return res.status(400).json({ success: false, message: "Thành viên đã ở trong đội" });
    }
    if (match.participants.length >= match.maxPlayers) {
      return res.status(400).json({ success: false, message: "Đội đã đầy người" });
    }
    if (!match.pendingInviteRequests) match.pendingInviteRequests = [];
    if (match.pendingInviteRequests.some((entry) => String(entry.userId) === String(userId))) {
      return res.status(400).json({ success: false, message: "Đã gửi lời mời cho người này rồi" });
    }

    match.pendingInviteRequests.push({
      userId,
      invitedBy: inviter,
      requiresOwnerApproval: !isOwnerInvite,
    });
    await match.save();

    try {
      await Notification.create({
        userId,
        type: "match",
        message: isOwnerInvite
          ? `Bạn được chủ đội mời tham gia đội "${match.title}". Vào Chi tiết trận đấu để chấp nhận.`
          : `Bạn được mời tham gia đội "${match.title}". Chủ đội sẽ duyệt lời mời của bạn.`,
      });
    } catch (notifErr) {
      console.error("Create notification error:", notifErr);
    }

    try { global.io.to(String(userId)).emit('team-invite', { matchId: match._id }); } catch(e) {}

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({
      success: true,
      message: isOwnerInvite
        ? "Đã gửi lời mời, người được mời có thể chấp nhận ngay"
        : "Đã gửi lời mời, chủ đội sẽ duyệt trước khi người này vào đội",
      data: updated,
    });
  } catch (error) {
    console.error("Invite member error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Accept a direct invite from the owner
router.post("/:id/accept-invite", async (req, res) => {
  try {
    const { userId } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    const inviteEntry = (match.pendingInviteRequests || []).find((entry) => String(entry.userId) === String(userId));
    if (!inviteEntry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời" });
    }
    if (inviteEntry.requiresOwnerApproval) {
      return res.status(403).json({ success: false, message: "Lời mời này cần chủ đội duyệt trước" });
    }

    match.pendingInviteRequests = (match.pendingInviteRequests || []).filter((entry) => String(entry.userId) !== String(userId));
    if (!match.participants.some((p) => String(p) === String(userId))) {
      match.participants.push(userId);
      match.currentPlayers = match.participants.length;
      if (match.currentPlayers >= match.maxPlayers) {
        match.status = "full";
      }
      if (!match.memberRoles) match.memberRoles = [];
      match.memberRoles.push({ userId, role: "member" });
      if (!match.memberPositions) match.memberPositions = [];
      match.memberPositions.push({ userId, positionId: "" });
    }
    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Đã vào đội thành công", data: updated });
  } catch (error) {
    console.error("Accept invite error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Owner approves an invite sent by a member
router.post("/:id/approve-invite", async (req, res) => {
  try {
    const { ownerId, userId } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }

    const ownerEntry = Array.isArray(match.memberRoles)
      ? match.memberRoles.find((entry) => entry?.role === "owner")
      : null;
    const actualOwnerId = ownerEntry?.userId || match.createdBy;
    if (!ownerId || String(ownerId) !== String(actualOwnerId)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội mới có quyền duyệt lời mời" });
    }

    const inviteEntry = (match.pendingInviteRequests || []).find((entry) => String(entry.userId) === String(userId));
    if (!inviteEntry || !inviteEntry.requiresOwnerApproval) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lời mời cần duyệt" });
    }

    match.pendingInviteRequests = (match.pendingInviteRequests || []).filter((entry) => String(entry.userId) !== String(userId));
    if (!match.participants.some((p) => String(p) === String(userId))) {
      match.participants.push(userId);
      match.currentPlayers = match.participants.length;
      if (match.currentPlayers >= match.maxPlayers) {
        match.status = "full";
      }
      if (!match.memberRoles) match.memberRoles = [];
      match.memberRoles.push({ userId, role: "member" });
      if (!match.memberPositions) match.memberPositions = [];
      match.memberPositions.push({ userId, positionId: "" });
    }
    await match.save();

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Đã duyệt lời mời và thêm vào đội", data: updated });
  } catch (error) {
    console.error("Approve invite error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Thêm thành viên trực tiếp vào đội (không cần chấp nhận)
router.post("/:id/add-member", async (req, res) => {
  try {
    const { ownerId, userId } = req.body;
    if (!ownerId || !userId) {
      return res.status(400).json({ success: false, message: "Thiếu ownerId hoặc userId" });
    }
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    // Kiểm tra quyền chủ đội
    const ownerEntry = Array.isArray(match.memberRoles)
      ? match.memberRoles.find((entry) => entry?.role === "owner")
      : null;
    const actualOwnerId = ownerEntry?.userId || match.createdBy;
    if (String(actualOwnerId) !== String(ownerId)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội mới có quyền thực hiện" });
    }
    // Kiểm tra đã là thành viên chưa
    if (match.participants.some((p) => String(p) === String(userId))) {
      return res.status(400).json({ success: false, message: "Thành viên đã ở trong đội" });
    }
    // Kiểm tra đội đầy chưa
    if (match.participants.length >= match.maxPlayers) {
      return res.status(400).json({ success: false, message: "Đội đã đầy người" });
    }

    // Thêm thành viên vào đội
    match.participants.push(userId);
    match.currentPlayers = match.participants.length;
    if (match.currentPlayers >= match.maxPlayers) {
      match.status = "full";
    }

    // Gán role và position mặc định
    if (!match.memberRoles) match.memberRoles = [];
    match.memberRoles.push({ userId, role: "member" });
    if (!match.memberPositions) match.memberPositions = [];
    match.memberPositions.push({ userId, positionId: "" });

    // Xoá khỏi pendingJoinRequests nếu có
    if (match.pendingJoinRequests) {
      match.pendingJoinRequests = match.pendingJoinRequests.filter(
        (p) => String(p) !== String(userId)
      );
    }

    await match.save();

    // Tạo thông báo cho user được thêm
    try {
      await Notification.create({
        userId,
        type: "match",
        message: `Bạn đã được thêm vào đội "${match.title}"`,
      });
    } catch (notifErr) {
      console.error("Create notification error:", notifErr);
    }

    // Emit socket event thông báo realtime
    try { global.io.to(String(userId)).emit('team-member-added', { matchId: match._id }); } catch(e) {}

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Đã thêm thành viên vào đội", data: updated });
  } catch (error) {
    console.error("Add member error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Update member role / transfer ownership
router.post("/:id/update-member-role", async (req, res) => {
  try {
    const { ownerId, userId, role } = req.body; // role: "owner" or "member"
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    // Kiểm tra quyền chủ đội
    if (!ownerId || String(ownerId) !== String(match.createdBy)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội mới có quyền thực hiện" });
    }

    if (!match.memberRoles) match.memberRoles = [];

    if (role === "owner") {
      // Transfer ownership: old owner becomes member, new one becomes owner
      // Set all other roles to member
      match.memberRoles.forEach((r) => {
        if (String(r.userId) === String(userId)) {
          r.role = "owner";
        } else {
          r.role = "member";
        }
      });
      match.createdBy = userId; // update match creator/owner in DB
    } else {
      // Degrade to member
      match.memberRoles.forEach((r) => {
        if (String(r.userId) === String(userId)) {
          r.role = "member";
        }
      });
    }

    await match.save();

    // Emit socket event thông báo realtime cho user bị thay đổi role
    try { global.io.to(String(userId)).emit('team-role-changed', { matchId: match._id }); } catch(e) {}

    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Cập nhật chức vụ thành công", data: updated });
  } catch (error) {
    console.error("Update role error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Update member position
router.post("/:id/update-member-position", async (req, res) => {
  try {
    const { ownerId, userId, positionId } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: "Không tìm thấy trận đấu" });
    }
    // Kiểm tra quyền chủ đội
    if (!ownerId || String(ownerId) !== String(match.createdBy)) {
      return res.status(403).json({ success: false, message: "Chỉ chủ đội mới có quyền thực hiện" });
    }

    if (!match.memberPositions) match.memberPositions = [];
    const posIndex = match.memberPositions.findIndex((p) => String(p.userId) === String(userId));
    if (posIndex > -1) {
      match.memberPositions[posIndex].positionId = positionId;
    } else {
      match.memberPositions.push({ userId, positionId });
    }

    await match.save();
    const updated = await Match.findById(match._id).populate(populateFields);
    return res.json({ success: true, message: "Cập nhật vị trí thành công", data: updated });
  } catch (error) {
    console.error("Update position error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;