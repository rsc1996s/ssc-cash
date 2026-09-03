import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ค่าเหล่านี้มาจากไฟล์ .env (ดู .env.example)
// ห้าม hardcode ค่าจริงไว้ในไฟล์นี้ — ให้ตั้งค่าผ่าน environment variables
// ทั้งตอน dev (.env) และบน Netlify (Site settings > Environment variables)
//
// หมายเหตุ: แอปนี้ไม่ใช้ Firebase Storage เลย (รูปภาพ/ลายเซ็นถูกบีบอัดแล้วเก็บเป็น
// base64 ใน Firestore โดยตรง) เพื่อให้ใช้แพ็กฟรี Spark ได้ 100% โดยไม่ต้องผูกบัตรเครดิต
// จึงไม่ต้องตั้งค่า storageBucket หรือสร้าง Storage bucket ใดๆ ก็ได้
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export { firebaseConfig };
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
