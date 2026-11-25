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
import useScopedCashData from "../hooks/useScopedCashData";
import Sheet from "../components/ui/Sheet";
import Input from "../components/ui/Input";
import { normalizeSearchText } from "../components/ui/searchText";

const ACTION_LABELS = {
  "transaction-status-changed": "เปลี่ยนสถานะรายการ",
  "transaction-evidence-requested": "ขอหลักฐานรายการ",
  "transaction-evidence-submitted": "ส่งหลักฐานรายการ",
  "transaction-evidence-request-cancelled": "ยกเลิกคำขอหลักฐาน",
  "user-created": "เพิ่มผู้ใช้",
  "user-access-changed": "เปลี่ยนงบที่ผู้ใช้ดูแล",
  "role-changed": "เปลี่ยนบทบาทผู้ใช้",
  "user-disabled": "ระงับผู้ใช้",
  "user-enabled": "เปิดใช้งานผู้ใช้",
  "fund-created": "สร้างงบค่าใช้จ่าย",
  "fund-updated": "แก้ไขข้อมูลงบค่าใช้จ่าย/ยอดตั้งต้น",
  "fund-topup-created": "เติมเงินเข้างบค่าใช้จ่าย",
  "withdrawal-deleted": "ลบใบเบิก",
  "withdrawal-received-changed": "เปลี่ยนยอดรับเงินจริง",
  "transfer-payment-deleted": "ลบใบโอนจ่าย",
  "daily-closing-created": "ปิดยอดประจำวัน",
  "daily-closing-corrected": "แก้ไขยอดปิดประจำวัน",
};

function activityDescription(activity, funds, users) {
  const { action, before, after } = activity;
  if (action === "user-access-changed") {
    const target = users.find((user) => user.id === activity.targetId)?.name || activity.targetId;
    const labels = (ids) => ids == null ? "ยังไม่ได้กำหนด (ทุกงบ)" :
      ids.map((id) => funds.find((fund) => fund.id === id)?.label || id).join(", ") || "ไม่มีงบ";
    return `${target}: ${labels(before?.fundIds)} → ${labels(after?.fundIds)} · ชื่อบทบาท ${before?.roleLabel || "ไม่ระบุ"} → ${after?.roleLabel || "ไม่ระบุ"}`;
  }
  if (action === "transaction-status-changed" || action?.startsWith("transaction-evidence-")) {
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
  if (action === "withdrawal-received-changed") return `ใบเบิก ${activity.targetId}: ${before?.receivedAmount == null ? "ยังไม่ระบุ" : formatBaht(before.receivedAmount)} → ${formatBaht(after?.receivedAmount)} บาท`;
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
  const [usersError, setUsersError] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { funds, error: fundsError } = useScopedCashData();

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

  useEffect(() => onSnapshot(collection(db, "users"),
    (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setUsersError("");
    },
    (loadError) => {
      console.error("โหลดชื่อผู้ใช้ในประวัติไม่สำเร็จ:", loadError);
      setUsersError("โหลดชื่อผู้ใช้ในประวัติไม่สำเร็จ จะแสดงรหัสผู้ใช้แทน");
    }), []);

  const filtered = activities.filter((activity) => normalizeSearchText([
    ACTION_LABELS[activity.action] || activity.action,
    activity.actorName, activity.actorUid, activity.targetId,
    activityDescription(activity, funds, users),
  ].join(" ")).includes(normalizeSearchText(search)));

  return (
    <Layout>
      <PageHeader title="ประวัติการใช้งาน" fallbackTo="/settings" />
      <p className="mb-4 text-sm text-inkSoft">แสดงเหตุการณ์ล่าสุด 100 รายการ · ดูได้เฉพาะเจ้าของร้าน</p>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center justify-between rounded-lg border border-paperLine bg-white px-4 text-left">
        <span>ดูประวัติการใช้งาน</span><span className="text-sm text-inkSoft">›</span>
      </button>
      <Sheet open={open} title="ประวัติการใช้งาน" onClose={() => setOpen(false)}>
      <Input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(20); }} placeholder="ค้นหาประวัติ" aria-label="ค้นหาประวัติ" className="mb-4 w-full" />
      {fundsError && <p role="alert" className="mb-4 text-sm text-danger">โหลดชื่องบไม่สำเร็จ จะแสดงรหัสงบแทน</p>}
      {usersError && <p role="alert" className="mb-4 text-sm text-danger">{usersError}</p>}
      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</p>
      ) : loading ? (
        <Loading label="กำลังโหลดประวัติการใช้งาน" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title={search ? "ไม่พบประวัติที่ค้นหา" : "ยังไม่มีประวัติการใช้งาน"} />
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, visibleCount).map((activity) => (
            <Card key={activity.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{ACTION_LABELS[activity.action] || activity.action}</p>
                  <p className="mt-1 text-sm text-inkSoft">{activityDescription(activity, funds, users)}</p>
                  <p className="mt-1 text-xs text-inkSoft">
                    {activity.actorName || activity.actorUid} · {activity.targetCollection}/{activity.targetId}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-inkSoft">{formatDateTime(activity.createdAt)}</time>
              </div>
            </Card>
          ))}
          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 20)}
              className="w-full rounded-lg border border-paperLine bg-white py-3 text-sm font-medium text-blue-700"
            >
              ดูเพิ่มเติม ({filtered.length - visibleCount} รายการ)
            </button>
          )}
        </div>
      )}
      </Sheet>
    </Layout>
  );
}
