const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

const sendOTP = async (email, otp) => {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] OTP cho ${email}: ${otp}`);
      return;
    }

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
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendOTP;
