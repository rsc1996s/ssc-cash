import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { downloadCsv } from "../components/csvExport";
import PrintSheet from "../components/PrintSheet";
import WithdrawalRequestDocument from "../components/WithdrawalRequestDocument";
import { withdrawalReportRows } from "../components/withdrawalReportData";
import Button from "../components/ui/Button";

export default function WithdrawalRequestPrint() {
  const { id } = useParams();
  const { isOwner } = useAuth();
  const [request, setRequest] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [showNote, setShowNote] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "withdrawalRequests", id),
      (snapshot) => {
        if (snapshot.exists()) {
          setRequest({ id: snapshot.id, ...snapshot.data() });
          setError("");
        } else {
          setError("ไม่พบใบเบิกนี้");
        }
        setLoading(false);
      },
      (loadError) => {
        console.error("โหลดใบเบิกสำหรับพิมพ์ไม่สำเร็จ:", loadError);
        setError("โหลดใบเบิกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!isOwner) {
      setPayments([]);
      return undefined;
    }
    const unsubscribe = onSnapshot(
      collection(db, "transferPayments"),
      (snapshot) => setPayments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (loadError) => {
        console.error("โหลดใบโอนจ่ายสำหรับรายงานไม่สำเร็จ:", loadError);
        setError("โหลดข้อมูลยอดโอนจ่ายไม่สำเร็จ กรุณาลองใหม่");
      }
    );
    return () => unsubscribe();
  }, [isOwner]);

  if (loading) return <div className="p-8 text-inkSoft">กำลังโหลด...</div>;
  if (error || !request) return <div role="alert" className="p-8 text-rust">{error || "ไม่พบใบเบิกนี้"}</div>;

  function exportCsv() {
    const rows = withdrawalReportRows(request.lines || [], groupByCategory).map((entry) => {
      if (entry.type === "category") return ["", `หมวด: ${entry.category}`, "", ""];
      if (entry.type === "subtotal") return ["", `ยอดย่อย ${entry.category}`, "", entry.amount];
      return [
        entry.line.lineNo || entry.index + 1,
        entry.line.categoryLabel || "-",
        entry.line.description || "",
        Number(entry.line.amount) || 0,
      ];
    });
    downloadCsv(`ใบเบิก-${request.requestNo || id}.csv`, ["ลำดับ", "รายการ (หมวด)", "รายละเอียด", "จำนวนเงิน"], rows);
  }

  const actions = (
    <>
      <Button onClick={() => window.print()}>พิมพ์ / บันทึก PDF</Button>
      <Button variant="secondary" onClick={exportCsv}>ส่งออก CSV</Button>
    </>
  );

  return (
    <PrintSheet actions={actions}>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button
          variant={groupByCategory ? "secondary" : "primary"}
          aria-pressed={!groupByCategory}
          onClick={() => setGroupByCategory(false)}
        >
          เรียงตามลำดับ
        </Button>
        <Button
          variant={groupByCategory ? "primary" : "secondary"}
          aria-pressed={groupByCategory}
          onClick={() => setGroupByCategory(true)}
        >
          จัดกลุ่มตามหมวดพร้อมยอดย่อย
        </Button>
        <Button variant="secondary" aria-pressed={showNote} onClick={() => setShowNote((value) => !value)}>
          {showNote ? "ซ่อนหมายเหตุ" : "แสดงหมายเหตุ"}
        </Button>
      </div>
      <WithdrawalRequestDocument
        request={request}
        isOwner={isOwner}
        payments={payments}
        groupByCategory={groupByCategory}
        showNote={showNote}
      />
    </PrintSheet>
  );
}
