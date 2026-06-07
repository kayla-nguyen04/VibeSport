const express = require("express");
const otpGenerator = require("otp-generator");
const sendOTP = require("../utils/sendOtp");

const router = express.Router();

const otpStore = {};

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    otpStore[email] = otp;
    console.log(`[OTP ROUTE] Generated OTP for ${email}: ${otp}`);

    await sendOTP(email, otp);

    res.json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error("send-otp error:", error.message);

    let message = "Không gửi được mã OTP. Vui lòng thử lại sau.";

    if (error.code === "EMAIL_NOT_CONFIGURED") {
      message = "Server chưa cấu hình email. Liên hệ quản trị viên.";
    } else if (
      error.code === "EAUTH" ||
      String(error.message).includes("535") ||
      String(error.message).includes("Invalid login")
    ) {
      message =
        "Lỗi xác thực Gmail. Hãy dùng App Password (không dùng mật khẩu đăng nhập thường). Xem hướng dẫn tại https://support.google.com/accounts/answer/185833";
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

  if (otpStore[email] === otp) {
    delete otpStore[email];

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