import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "../firebase";

/**
 * ปกติแล้วถ้าเรียก createUserWithEmailAndPassword ด้วย auth instance หลัก
 * เบราว์เซอร์จะเด้งไปล็อกอินเป็นบัญชีใหม่นั้นทันที (เจ้าของร้านจะหลุดออกจากระบบตัวเอง!)
 * ฟังก์ชันนี้แก้ปัญหาด้วยการสร้าง Firebase App สำรองชั่วคราวแยกต่างหาก
 * ใช้สร้างบัญชีใหม่โดยไม่กระทบ session ที่ล็อกอินอยู่ในแอปหลักเลย
 */
export async function createAccountWithoutSigningIn(email, password) {
  const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const tempAuth = getAuth(tempApp);
  try {
    const cred = await createUserWithEmailAndPassword(tempAuth, email, password);
    const uid = cred.user.uid;
    await signOut(tempAuth);
    return uid;
  } finally {
    await deleteApp(tempApp);
  }
}
