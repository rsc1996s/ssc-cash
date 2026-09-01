// ระบบนี้ใช้ "PIN ล้วนๆ" ในการเข้าสู่ระบบ ไม่มีชื่อผู้ใช้เลย
// เบื้องหลังยังคงใช้ Firebase Auth แบบ email/password เดิม (ฟรี ไม่ต้อง Cloud Functions/Blaze)
// โดยตอนสมัคร จะสุ่มอีเมลปลอมที่ไม่มีการส่งจริงขึ้นมาผูกกับบัญชี แล้วเก็บคู่ "PIN -> อีเมลปลอม"
// ไว้ใน collection ชื่อ pinDirectory เพื่อให้ตอนล็อกอินใช้ PIN อย่างเดียวค้นหาบัญชีที่ถูกต้องได้
// PIN -> รหัสผ่าน: เติม 0 ข้างหน้าให้ครบ 6 หลักเสมอ เพราะ Firebase บังคับรหัสผ่านอย่างน้อย 6 ตัวอักษร

const FAKE_EMAIL_DOMAIN = "pin.local";

export const PIN_PATTERN = /^\d{4,6}$/;

export function pinToPassword(pin) {
  return (pin || "").trim().padStart(6, "0");
}

export function randomPinEmail() {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `u${rand}@${FAKE_EMAIL_DOMAIN}`;
}
