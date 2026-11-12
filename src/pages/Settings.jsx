import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ChevronRight, History, Landmark, Tags, Users } from "lucide-react";
import { db } from "../firebase";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import ListRow from "../components/ui/ListRow";

const settingsItems = [
  {
    to: "/settings/users",
    label: "ผู้ใช้งาน",
    description: "อนุมัติและจัดการบัญชีผู้ใช้",
    icon: Users,
    showPendingCount: true,
  },
  {
    to: "/settings/categories",
    label: "หมวดหมู่",
    description: "จัดการหมวดหมู่เงินสดและใบเบิกโอน",
    icon: Tags,
  },
  {
    to: "/settings/bank-accounts",
    label: "บัญชีธนาคาร",
    description: "จัดการบัญชีต้นทางและบัญชีผู้รับ",
    icon: Landmark,
  },
  {
    to: "/settings/activity",
    label: "ประวัติใช้งาน",
    description: "ตรวจสอบเหตุการณ์ที่เกิดขึ้นในระบบ",
    icon: History,
  },
];

export default function Settings() {
  const [pendingUserCount, setPendingUserCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "users"), where("role", "==", "pending")),
      (snapshot) => setPendingUserCount(snapshot.size),
      (error) => console.error("โหลดจำนวนผู้ใช้รออนุมัติไม่สำเร็จ:", error)
    );
    return () => unsubscribe();
  }, []);

  return (
    <Layout>
      <PageHeader title="ตั้งค่า" fallbackTo="/" />
      <div className="space-y-3">
        {settingsItems.map(({ to, label, description, icon: Icon, showPendingCount }) => (
          <ListRow
            key={to}
            to={to}
            className="min-h-20 p-4"
            leading={<span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Icon size={21} />
            </span>}
            title={
              <span className="flex items-center gap-2 font-semibold">
                {label}
                {showPendingCount && pendingUserCount > 0 && (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rust px-2 py-0.5 text-xs font-semibold text-white">
                    {pendingUserCount}
                  </span>
                )}
              </span>
            }
            description={description}
            trailing={<ChevronRight className="text-inkSoft" size={20} />}
          />
        ))}
      </div>
    </Layout>
  );
}
