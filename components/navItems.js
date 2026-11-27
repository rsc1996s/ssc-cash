import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Receipt,
  Settings,
  Wallet,
  ArrowDownToLine,
} from "lucide-react";

export function getNavItems({ isOwner, isGuest, isStaff, pendingTxCount = 0, pendingUserCount = 0 }) {
  return [
    { to: "/", icon: Receipt, label: "หน้าหลัก", show: true },
    { to: "/receipts", icon: ArrowDownToLine, label: "รับโอน", show: isOwner || isStaff },
    {
      to: "/transfers",
      icon: FileText,
      label: isOwner ? "โอนจ่าย" : "ใบเบิกเงินโอน",
      show: isOwner || isStaff,
    },
    { to: "/owner", icon: ClipboardCheck, label: "ตรวจสอบทั้งหมด", badge: pendingTxCount, show: isOwner },
    { to: "/admin/funds", icon: Wallet, label: "งบค่าใช้จ่าย", show: isOwner },
    { to: "/reports", icon: BarChart3, label: "รายงาน", show: isOwner || isGuest },
    { to: "/daily-closings", icon: ClipboardList, label: "ปิดยอด", show: isOwner || isStaff },
    { to: "/settings", icon: Settings, label: "ตั้งค่า", badge: pendingUserCount, show: isOwner },
  ].filter((item) => item.show);
}
