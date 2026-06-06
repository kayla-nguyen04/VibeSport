const express = require("express");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const sendOTP = require("../utils/sendOtp");
const { validateEmail, validateEmailDomain } = require("../utils/validateEmail");

const router = express.Router();

const otpStore = {};

router.post("/send-otp", async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!purpose || !["register", "forgot"].includes(purpose)) {
      return res.status(400).json({
        success: false,
        message: "Thiếu loại yêu cầu OTP.",
      });
    }

    const validation = validateEmail(email);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const domainOk = await validateEmailDomain(validation.domain);

    if (!domainOk) {
      return res.status(400).json({
        success: false,
        message: "Tên miền email không tồn tại hoặc không nhận thư.",
      });
    }

    const normalizedEmail = validation.email;
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (purpose === "register" && existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email đã được đăng ký trên hệ thống.",
      });
    }

    if (purpose === "forgot" && !existingUser) {
      return res.status(404).json({
        success: false,
        message: "Email chưa được đăng ký trên hệ thống.",
      });
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    otpStore[normalizedEmail] = otp;

    await sendOTP(normalizedEmail, otp);

    res.json({
      success: true,
      message: "OTP sent",
    });
  } catch (error) {
    console.error("send-otp error:", error.message);

    let message = "Không gửi được mã OTP. Vui lòng thử lại sau.";

    if (error.code === "EMAIL_NOT_CONFIGURED") {
      message = "Server chưa cấu hình email. Liên hệ quản trị viên.";
    } else if (error.code === "EAUTH" || String(error.message).includes("535")) {
      message =
        "Không gửi được email. Tài khoản Gmail cần dùng App Password (không dùng mật khẩu đăng nhập thường).";
    }

    res.status(500).json({
      success: false,
      message,
    });
  }
});

router.post("/verify-otp", (req, res) => {
  const validation = validateEmail(req.body?.email);

  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.message,
    });
  }

  const { otp } = req.body;

  if (otpStore[validation.email] === otp) {
    delete otpStore[validation.email];

    return res.json({
      success: true,
      message: "OTP correct",
    });
  }

  res.status(400).json({
    success: false,
    message: "OTP incorrect",
  });
});

module.exports = router;
