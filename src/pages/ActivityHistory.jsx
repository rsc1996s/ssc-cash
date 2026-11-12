import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Loading from "../components/ui/Loading";
import EmptyState from "../components/ui/EmptyState";
import { STATUS_LABEL, formatDateTime, formatBaht } from "../lib/format";
import { History } from "lucide-react";
import PageHeader from "../components/ui/PageHeader";

const ACTION_LABELS = {
  "transaction-status-changed": "เปลี่ยนสถานะรายการ",
  "user-created": "เพิ่มผู้ใช้",
  "role-changed": "เปลี่ยนบทบาทผู้ใช้",
  "user-disabled": "ระงับผู้ใช้",
  "user-enabled": "เปิดใช้งานผู้ใช้",
  "fund-created": "สร้างงบค่าใช้จ่าย",
  "fund-updated": "แก้ไขข้อมูลงบค่าใช้จ่าย/ยอดตั้งต้น",
  "fund-topup-created": "เติมเงินเข้างบค่าใช้จ่าย",
  "withdrawal-deleted": "ลบใบเบิก",
  "transfer-payment-deleted": "ลบใบโอนจ่าย",
  "daily-closing-created": "ปิดยอดประจำวัน",
  "daily-closing-corrected": "แก้ไขยอดปิดประจำวัน",
};

function activityDescription(activity) {
  const { action, before, after } = activity;
  if (action === "transaction-status-changed") {
    return `${STATUS_LABEL[before?.status] || before?.status || "—"} → ${STATUS_LABEL[after?.status] || after?.status || "—"}`;
  }
  if (action === "role-changed" || action === "user-created") {
    return `${before?.role || "—"} → ${after?.role || "—"}`;
  }
  if (action === "fund-updated") {
    return `ยอดตั้งต้น ${formatBaht(before?.openingBalance)} → ${formatBaht(after?.openingBalance)} บาท`;
  }
  if (action === "fund-topup-created") return `เติม ${formatBaht(after?.amount)} บาท`;
  if (action === "withdrawal-deleted") return `ใบเบิก ${before?.requestNo || activity.targetId}`;
  if (action === "transfer-payment-deleted") return `ใบโอน ${before?.transferNo || activity.targetId}`;
  if (typeof action === "string" && action.startsWith("daily-closing-")) {
    return `${after?.businessDate || ""} · ส่วนต่าง ${Number(after?.difference) > 0 ? "+" : ""}${formatBaht(after?.difference)} บาท`;
  }
  if (activity.targetCollection === "users") return `บัญชี ${activity.targetId}`;
  return `${activity.targetCollection}/${activity.targetId}`;
}

export default function ActivityHistory() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(100)),
      (snapshot) => {
        setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setError("");
        setLoading(false);
      },
      (loadError) => {
        console.error("โหลดประวัติการใช้งานไม่สำเร็จ:", loadError);
        setError("โหลดประวัติการใช้งานไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <Layout>
      <PageHeader title="ประวัติการใช้งาน" fallbackTo="/settings" />
      <p className="mb-4 text-sm text-inkSoft">แสดงเหตุการณ์ล่าสุด 100 รายการ · ดูได้เฉพาะเจ้าของร้าน</p>
      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>
      ) : loading ? (
        <Loading label="กำลังโหลดประวัติการใช้งาน" />
      ) : activities.length === 0 ? (
        <EmptyState icon={History} title="ยังไม่มีประวัติการใช้งาน" description="เหตุการณ์ใหม่จะแสดงที่นี่" />
      ) : (
        <div className="space-y-3">
          {activities.slice(0, visibleCount).map((activity) => (
            <Card key={activity.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{ACTION_LABELS[activity.action] || activity.action}</p>
                  <p className="mt-1 text-sm text-inkSoft">{activityDescription(activity)}</p>
                  <p className="mt-1 text-xs text-inkSoft">
                    {activity.actorName || activity.actorUid} · {activity.targetCollection}/{activity.targetId}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-inkSoft">{formatDateTime(activity.createdAt)}</time>
              </div>
            </Card>
          ))}
          {activities.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 20)}
              className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm font-medium text-blue-700"
            >
              ดูเพิ่มเติม ({activities.length - visibleCount} รายการ)
            </button>
          )}
        </div>
      )}
    </Layout>
  );
}
