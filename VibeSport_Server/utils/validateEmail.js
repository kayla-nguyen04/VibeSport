const dns = require("node:dns").promises;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,63})+$/;

const INCOMPLETE_DOMAINS = new Set([
  "gmail",
  "yahoo",
  "hotmail",
  "outlook",
  "icloud",
  "live",
  "googlemail",
]);

function validateEmail(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return { valid: false, message: "Vui lòng nhập email" };
  }

  if (!normalized.includes("@")) {
    return { valid: false, message: "Email phải có ký tự @" };
  }

  const [localPart, domain] = normalized.split("@");

  if (!localPart || !domain) {
    return { valid: false, message: "Email không đúng định dạng" };
  }

  if (!domain.includes(".")) {
    return {
      valid: false,
      message: "Email phải có tên miền đầy đủ (ví dụ: ten@gmail.com)",
    };
  }

  if (INCOMPLETE_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: "Email phải có tên miền đầy đủ (ví dụ: ten@gmail.com)",
    };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, message: "Email không đúng định dạng" };
  }

  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false, message: "Tên miền email không hợp lệ" };
  }

  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];

  if (domainParts.length < 2 || tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, message: "Tên miền email không hợp lệ" };
  }

  return { valid: true, email: normalized, domain };
}

async function validateEmailDomain(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (mxRecords?.length > 0) {
      return true;
    }
  } catch {
    // fall through to A record check
  }

  try {
    const aRecords = await dns.resolve4(domain);
    return aRecords?.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  validateEmail,
  validateEmailDomain,
};
