const express = require("express");
const otpGenerator = require("otp-generator");
const sendOTP = require("../utils/sendOtp");
const User = require("../models/User");

const router = express.Router();

const otpStore = {};

router.post("/send-otp", async (req, res) => {
  try {
    const { email, type = "register" } = req.body;
    const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        message: "Email không được để trống.",
      });
    }

    // Kiểm tra sự tồn tại của email trước khi gửi OTP
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (type === "forgot_password" || type === "reset_password" || type === "forgot") {
      if (!existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email chưa được đăng ký trong hệ thống.",
        });
      }
    } else {
      // Đăng ký tài khoản mới: nếu email đã tồn tại thì báo lỗi ngay
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email đã tồn tại. Vui lòng đăng nhập hoặc dùng email khác.",
        });
      }
    }

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    otpStore[normalizedEmail] = otp;
    console.log(`[OTP ROUTE] Generated OTP for ${normalizedEmail}: ${otp}`);

    // Dev bypass: nếu chưa cấu hình email thì in OTP ra console
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`\n========================================`);
      console.log(`[DEV MODE] OTP cho ${normalizedEmail}: ${otp}`);
      console.log(`========================================\n`);
      return res.json({
        success: true,
        message: "OTP sent successfully (dev mode - check server console)",
        devOtp: otp,
      });
    }

    await sendOTP(normalizedEmail, otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("send-otp error:", error.message);

    let message = "Không gửi được mã OTP. Vui lòng thử lại sau.";

    if (
      error.code === "EAUTH" ||
      String(error.message).includes("535") ||
      String(error.message).includes("Invalid login")
    ) {
      message =
        "Lỗi xác thực Gmail. Hãy dùng App Password (không dùng mật khẩu đăng nhập thường).";
    } else if (String(error.message).includes("getaddrinfo")) {
      message = "Lỗi kết nối mạng. Vui lòng kiểm tra kết nối Internet.";
    }

    res.status(500).json({
      success: false,
      message,
      detail: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});

router.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";

  if (normalizedEmail && otpStore[normalizedEmail] === String(otp).trim()) {
    delete otpStore[normalizedEmail];

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