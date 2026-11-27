// ใช้ชื่อผู้ใช้และ PIN 6 หลักสำหรับบัญชีใหม่ โดยยังรองรับ PIN เดิม 4-6 หลัก
// ระหว่างย้ายบัญชีจาก Firebase Auth email/password และ collection pinDirectory
// PIN -> รหัสผ่าน: เติม 0 ข้างหน้าให้ครบ 6 หลัก เพราะ Firebase บังคับรหัสผ่านอย่างน้อย 6 ตัวอักษร

const FAKE_EMAIL_DOMAIN = "pin.local";

export const PIN_PATTERN = /^\d{6}$/;
export const LEGACY_PIN_PATTERN = /^\d{4,6}$/;
export const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,23}$/;

export function normalizeUsername(username) {
  return (username || "").trim().toLowerCase();
}

export function pinToPassword(pin) {
  return (pin || "").trim().padStart(6, "0");
}

export function randomPinEmail() {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `u${rand}@${FAKE_EMAIL_DOMAIN}`;
}
