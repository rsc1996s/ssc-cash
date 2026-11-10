import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";

export function getNavItems({ isOwner, isGuest, isStaff, pendingTxCount = 0, pendingUserCount = 0 }) {
  return [
    { to: "/", icon: Receipt, label: isGuest ? "รายการทั้งหมด" : "รายการของฉัน", show: true },
    {
      to: "/transfers",
      icon: FileText,
      label: isOwner ? "โอนจ่าย" : "ใบเบิกเงินโอน",
      show: isOwner || isStaff,
    },
    { to: "/owner", icon: ClipboardCheck, label: "ตรวจสอบทั้งหมด", badge: pendingTxCount, show: isOwner },
    { to: "/admin/users", icon: Users, label: "ผู้ใช้งาน", badge: pendingUserCount, show: isOwner },
    { to: "/admin/funds", icon: Wallet, label: "งบค่าใช้จ่าย", show: isOwner },
    { to: "/reports", icon: BarChart3, label: "รายงาน", show: isOwner || isGuest },
    { to: "/daily-closings", icon: ClipboardList, label: "ปิดยอด", show: isOwner || isStaff },
    { to: "/activity", icon: History, label: "ประวัติใช้งาน", show: isOwner },
  ].filter((item) => item.show);
}
