const express = require("express");
const Match = require("../models/Match");

const router = express.Router();

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
      .populate("createdBy", "name email picture area favoriteSport position")
      .populate("participants", "name email picture");

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
    const match = await Match.findById(req.params.id)
      .populate("createdBy", "name email picture")
      .populate("participants", "name email picture");

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
    if (costPerPerson !== undefined) match.costPerPerson = Number(costPerPerson || 0);
    if (locationName) match.locationName = locationName.trim();
    if (location) match.location = location;
    if (note !== undefined) match.note = note;

    await match.save();

    const updated = await Match.findById(match._id)
      .populate("createdBy", "name email picture area favoriteSport position")
      .populate("participants", "name email picture");

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

module.exports = router;