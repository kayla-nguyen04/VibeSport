const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

const sendOTP = async (email, otp) => {
  console.log(`[OTP] Preparing to send OTP to: ${email}`);
  
  if (!isEmailConfigured()) {
    throw Object.assign(new Error("EMAIL_NOT_CONFIGURED"), { code: "EMAIL_NOT_CONFIGURED" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Mã OTP xác minh VibeSport",
    text: `Mã OTP của bạn là: ${otp}\n\nMã có hiệu lực trong 15 phút.`,
    html: `<p>Mã OTP của bạn là: <strong>${otp}</strong></p><p>Mã có hiệu lực trong 15 phút.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] OTP sent successfully to ${email}`);
  } catch (error) {
    console.error(`[EMAIL] Failed to send OTP to ${email}:`, error.message);
    throw error;
  }
};

module.exports = sendOTP;
