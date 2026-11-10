import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
const requiredFirebaseVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];
const firebaseEnvironment = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
};

function renderStartupError(message) {
  root.render(
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <section className="w-full max-w-lg bg-white border border-paperLine rounded-lg p-6">
        <h1 className="font-slab text-xl mb-3">ตั้งค่า Firebase ไม่สมบูรณ์</h1>
        <p className="text-sm text-inkSoft mb-4">{message}</p>
        <p className="text-sm font-medium mb-2">ตรวจสอบตัวแปรต่อไปนี้ในไฟล์ .env:</p>
        <ul className="list-disc list-inside text-sm font-nums text-inkSoft space-y-1">
          {requiredFirebaseVariables.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="text-sm text-inkSoft mt-4">
          คัดลอกจาก Firebase Console → Project settings → Your apps แล้วเริ่ม dev server ใหม่
          หลังแก้ไขไฟล์ .env
        </p>
      </section>
    </main>
  );
}

const missingVariables = requiredFirebaseVariables.filter((name) => {
  const value = firebaseEnvironment[name];
  return !value ||
    value.trim() === "" ||
    value.includes("...") ||
    value.startsWith("your-");
});

if (missingVariables.length > 0) {
  renderStartupError(`ยังไม่ได้กำหนดค่า: ${missingVariables.join(", ")}`);
} else {
  import("./App")
    .then(({ default: App }) => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch((error) => {
      console.error("แอปเริ่มต้นไม่สำเร็จ:", error);
      renderStartupError(
        "เริ่มต้น Firebase ไม่สำเร็จ โปรดตรวจสอบว่าค่าทั้งหมดใน .env มาจาก Firebase โปรเจกต์เดียวกัน แล้วหยุดและเริ่ม dev server ใหม่"
      );
    });
}
