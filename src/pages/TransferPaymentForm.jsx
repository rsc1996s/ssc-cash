import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht } from "../lib/format";
import { nextDocNumber } from "../lib/counters";
import { lineTotal, renumberLines, remainingBalance } from "../lib/transfers";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(n) {
  return { lineNo: n, transferDate: todayStr(), amount: "", payeeAccountId: "", note: "" };
}

export default function TransferPaymentForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [payeeAccounts, setPayeeAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [allPayments, setAllPayments] = useState([]);

  const [transferNo, setTransferNo] = useState(null);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [linkedWithdrawalRequestId, setLinkedWithdrawalRequestId] = useState("");
  const [lines, setLines] = useState([emptyLine(1)]);
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "bankAccounts"), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSourceAccounts(all.filter((a) => a.side === "source"));
      setPayeeAccounts(all.filter((a) => a.side === "payee"));
    });
    const unsub2 = onSnapshot(collection(db, "withdrawalRequests"), (snap) =>
      setWithdrawals(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(collection(db, "transferPayments"), (snap) =>
      setAllPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    const unsub = onSnapshot(doc(db, "transferPayments", id), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setTransferNo(d.transferNo);
      setSourceAccountId(d.sourceAccountId);
      setLinkedWithdrawalRequestId(d.linkedWithdrawalRequestId);
      setLines(d.lines && d.lines.length ? d.lines : [emptyLine(1)]);
      setLoaded(true);
    });
    return () => unsub();
  }, [id, isNew]);

  // ใบเบิกที่เลือกได้ต้องเป็นบัญชี A เดียวกับที่เลือกไว้ (ถ้าเลือกบัญชีแล้ว)
  const availableWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => !sourceAccountId || w.sourceAccountId === sourceAccountId);
  }, [withdrawals, sourceAccountId]);

  const linkedWithdrawal = withdrawals.find((w) => w.id === linkedWithdrawalRequestId);
  const remainingBeforeThis =
    linkedWithdrawal
      ? remainingBalance(
          linkedWithdrawal,
          allPayments.filter((p) => p.id !== id)
        )
      : null;

  function selectWithdrawal(wId) {
    setLinkedWithdrawalRequestId(wId);
    const w = withdrawals.find((x) => x.id === wId);
    if (w) setSourceAccountId(w.sourceAccountId);
  }

  function updateLine(idx, field, value) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine(ls.length + 1)]);
  }

  function removeLine(idx) {
    setLines((ls) => renumberLines(ls.filter((_, i) => i !== idx)));
  }

  async function handleSave() {
    setError("");
    const account = sourceAccounts.find((a) => a.id === sourceAccountId);
    if (!account) {
      setError("กรุณาเลือกบัญชี A (บัญชีต้นทาง)");
      return;
    }
    if (!linkedWithdrawalRequestId) {
      setError("กรุณาเลือกใบเบิกที่จะตัดยอด");
      return;
    }
    const cleanLines = lines
      .filter((l) => Number(l.amount) > 0 && l.payeeAccountId)
      .map((l, i) => {
        const payee = payeeAccounts.find((p) => p.id === l.payeeAccountId);
        return {
          lineNo: i + 1,
          transferDate: l.transferDate,
          amount: Number(l.amount) || 0,
          payeeAccountId: l.payeeAccountId,
          payeeAccountLabel: payee ? `${payee.bankName} · ${payee.accountNumber} (${payee.accountName})` : "",
          note: (l.note || "").trim(),
        };
      });
    if (cleanLines.length === 0) {
      setError("กรุณาเพิ่มอย่างน้อย 1 รายการ พร้อมเลือกบัญชีผู้รับโอน");
      return;
    }

    setBusy(true);
    try {
      const sourceAccountLabel = `${account.bankName} · ${account.accountNumber} (${account.accountName})`;
      const w = withdrawals.find((x) => x.id === linkedWithdrawalRequestId);
      if (isNew) {
        const genNo = await nextDocNumber("transferPayments", "TP");
        await addDoc(collection(db, "transferPayments"), {
          transferNo: genNo,
          sourceAccountId,
          sourceAccountLabel,
          linkedWithdrawalRequestId,
          linkedWithdrawalRequestNo: w?.requestNo || "",
          lines: cleanLines,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: profile?.name || user.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "transferPayments", id), {
          sourceAccountId,
          sourceAccountLabel,
          linkedWithdrawalRequestId,
          linkedWithdrawalRequestNo: w?.requestNo || "",
          lines: cleanLines,
          updatedAt: serverTimestamp(),
        });
      }
      navigate("/transfers");
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("ลบใบโอนจ่ายนี้ทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้")) return;
    await deleteDoc(doc(db, "transferPayments", id));
    navigate("/transfers");
  }

  if (!loaded) {
    return (
      <Layout>
        <p className="text-sm text-inkSoft">กำลังโหลด...</p>
      </Layout>
    );
  }

  const total = lineTotal(lines);
  const overLimit = remainingBeforeThis != null && total > remainingBeforeThis;

  return (
    <Layout>
      <button onClick={() => navigate("/transfers")} className="text-sm text-inkSoft mb-4">
        ← กลับ
      </button>

      <div className="bg-white border border-paperLine rounded-lg p-6 receipt-edge">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-slab text-xl">{isNew ? "สร้างใบโอนจ่ายใหม่" : `แก้ไขใบโอนจ่าย ${transferNo}`}</h1>
          {!isNew && (
            <Link to={`/transfers/payments/${id}/print`} target="_blank" className="text-sm border border-paperLine rounded px-3 py-1.5">
              พิมพ์ / PDF
            </Link>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">โอนจากบัญชี (A)</label>
            <select
              value={sourceAccountId}
              onChange={(e) => {
                setSourceAccountId(e.target.value);
                setLinkedWithdrawalRequestId("");
              }}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            >
              <option value="">— เลือกบัญชี —</option>
              {sourceAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bankName} · {a.accountNumber} ({a.accountName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ตัดยอดกับใบเบิกเลขที่</label>
            <select
              value={linkedWithdrawalRequestId}
              onChange={(e) => selectWithdrawal(e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            >
              <option value="">— เลือกใบเบิก —</option>
              {availableWithdrawals.map((w) => {
                const remain = remainingBalance(w, allPayments.filter((p) => p.id !== id));
                return (
                  <option key={w.id} value={w.id}>
                    {w.requestNo} · คงเหลือ {formatBaht(remain)} บาท
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {linkedWithdrawal && (
          <p className="text-xs text-inkSoft mb-4">
            ยอดคงเหลือในใบเบิกนี้ก่อนบันทึกครั้งนี้: <span className="font-nums">{formatBaht(remainingBeforeThis)} บาท</span>
          </p>
        )}

        <div className="mb-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs text-inkSoft border-b border-paperLine">
                <th className="py-2 w-10">ลำดับ</th>
                <th className="py-2 w-36">วันที่โอน</th>
                <th className="py-2">ผู้รับโอน (B)</th>
                <th className="py-2 w-28 text-right">ยอดเงิน</th>
                <th className="py-2 w-32">หมายเหตุ</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx} className="border-b border-paperLine/60">
                  <td className="py-1.5 font-nums text-inkSoft">{idx + 1}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="date"
                      value={l.transferDate}
                      onChange={(e) => updateLine(idx, "transferDate", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={l.payeeAccountId}
                      onChange={(e) => updateLine(idx, "payeeAccountId", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal"
                    >
                      <option value="">— เลือกบัญชีผู้รับ —</option>
                      {payeeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName} · {a.accountNumber} ({a.accountName})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={l.amount}
                      onChange={(e) => updateLine(idx, "amount", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm text-right font-nums focus:border-teal"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={l.note}
                      onChange={(e) => updateLine(idx, "note", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal"
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    <button onClick={() => removeLine(idx)} className="text-rust text-xs">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payeeAccounts.length === 0 && (
            <p className="text-xs text-amber mt-1">
              ยังไม่มีบัญชีผู้รับโอนบันทึกไว้ —{" "}
              <Link to="/transfers/accounts" className="underline">
                เพิ่มบัญชีก่อน
              </Link>
            </p>
          )}
        </div>

        <button onClick={addLine} className="text-sm border border-paperLine rounded px-3 py-1.5 mb-4">
          + เพิ่มบรรทัด
        </button>

        <div className="flex justify-end mb-2">
          <div className="text-right">
            <div className="text-xs text-inkSoft">ยอดโอนจ่ายรวม</div>
            <div className="font-nums text-xl">{formatBaht(total)} บาท</div>
          </div>
        </div>

        {overLimit && (
          <p className="text-sm text-amber mb-3 text-right">
            * ยอดรวมเกินยอดคงเหลือของใบเบิกนี้ ({formatBaht(remainingBeforeThis)} บาท) กรุณาตรวจสอบก่อนบันทึก
          </p>
        )}

        {error && <p className="text-sm text-rust mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="bg-teal text-white rounded px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "กำลังบันทึก..." : "บันทึกใบโอนจ่าย"}
          </button>
          {!isNew && (
            <button onClick={handleDelete} className="border border-rust text-rust rounded px-5 py-2.5 text-sm">
              ลบใบนี้
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
