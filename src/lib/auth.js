// ระบบนี้ใช้ "ชื่อผู้ใช้ + PIN" แทนอีเมล/รหัสผ่านจากมุมมองผู้ใช้
// แต่เบื้องหลังยังคงใช้ Firebase Auth แบบ email/password เดิม (ฟรี ไม่ต้อง Cloud Functions/Blaze)
// โดยแปลง username -> อีเมลปลอมที่ไม่มีการส่งจริง และ PIN -> รหัสผ่าน (เติม 0 ข้างหน้าให้ครบ 6 หลัก
// เพราะ Firebase Auth บังคับรหัสผ่านอย่างน้อย 6 ตัวอักษร)

const FAKE_EMAIL_DOMAIN = "pin.local";

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,20}$/;
export const PIN_PATTERN = /^\d{4,6}$/;

export function normalizeUsername(username) {
  return (username || "").trim().toLowerCase();
}

export function usernameToEmail(username) {
  return `${normalizeUsername(username)}@${FAKE_EMAIL_DOMAIN}`;
}

export function pinToPassword(pin) {
  return (pin || "").trim().padStart(6, "0");
}
