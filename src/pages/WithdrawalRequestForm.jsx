import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht } from "../lib/format";
import { nextDocNumber } from "../lib/counters";
import { lineTotal, renumberLines } from "../lib/transfers";
import Combobox from "../components/Combobox";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(n) {
  return { lineNo: n, categoryLabel: "", description: "", amount: "" };
}

export default function WithdrawalRequestForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, profile, isOwner } = useAuth();

  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [requestNo, setRequestNo] = useState(null);
  const [createdBy, setCreatedBy] = useState(null);
  const [createdByName, setCreatedByName] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([emptyLine(1)]);
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canEdit = isNew || isOwner || createdBy === user.uid;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bankAccounts"), (snap) => {
      setSourceAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.side === "source"));
    });
    const unsub2 = onSnapshot(collection(db, "transferCategories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (isNew) return;
    const unsub = onSnapshot(doc(db, "withdrawalRequests", id), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setRequestNo(d.requestNo);
      setCreatedBy(d.createdBy || null);
      setCreatedByName(d.createdByName || "");
      setSourceAccountId(d.sourceAccountId);
      setDate(d.date);
      setNote(d.note || "");
      setLines(d.lines && d.lines.length ? d.lines : [emptyLine(1)]);
      setLoaded(true);
    });
    return () => unsub();
  }, [id, isNew]);

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
    const cleanLines = lines
      .filter((l) => l.description.trim() || Number(l.amount) > 0)
      .map((l, i) => ({
        lineNo: i + 1,
        categoryLabel: l.categoryLabel || "",
        description: l.description.trim(),
        amount: Number(l.amount) || 0,
      }));
    if (cleanLines.length === 0) {
      setError("กรุณาเพิ่มอย่างน้อย 1 รายการ");
      return;
    }

    setBusy(true);
    try {
      const sourceAccountLabel = `${account.bankName} · ${account.accountNumber} (${account.accountName})`;
      if (isNew) {
        const genNo = await nextDocNumber("withdrawalRequests", "WR");
        await addDoc(collection(db, "withdrawalRequests"), {
          requestNo: genNo,
          sourceAccountId,
          sourceAccountLabel,
          date,
          note: note.trim(),
          lines: cleanLines,
          totalAmount: lineTotal(cleanLines),
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: profile?.name || user.email,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "withdrawalRequests", id), {
          sourceAccountId,
          sourceAccountLabel,
          date,
          note: note.trim(),
          lines: cleanLines,
          totalAmount: lineTotal(cleanLines),
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
    if (!confirm("ลบใบเบิกนี้ทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้")) return;
    await deleteDoc(doc(db, "withdrawalRequests", id));
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

  return (
    <Layout>
      <button onClick={() => navigate("/transfers")} className="text-sm text-inkSoft mb-4">
        ← กลับ
      </button>

      <div className="bg-white border border-paperLine rounded-lg p-6 receipt-edge">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-slab text-xl">
            {isNew ? "สร้างใบเบิกเงินโอนใหม่" : `${canEdit ? "แก้ไข" : "ดู"}ใบเบิก ${requestNo}`}
          </h1>
          {!isNew && (
            <Link to={`/transfers/withdrawals/${id}/print`} target="_blank" className="text-sm border border-paperLine rounded px-3 py-1.5">
              พิมพ์ / PDF
            </Link>
          )}
        </div>

        {!isNew && !canEdit && (
          <p className="text-xs text-amber bg-amber-light border border-amber/40 rounded px-3 py-2 mb-4">
            ใบเบิกนี้สร้างโดย {createdByName} — ดูได้อย่างเดียว แก้ไข/ลบได้เฉพาะผู้สร้างเองหรือเจ้าของร้าน
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-sm text-inkSoft block mb-1">รับโอนเข้าบัญชี (A)</label>
            <Combobox
              value={sourceAccountId}
              onChange={setSourceAccountId}
              disabled={!canEdit}
              placeholder="— เลือกบัญชี —"
              options={sourceAccounts.map((a) => ({
                value: a.id,
                label: `${a.bankName} · ${a.accountNumber}`,
                sublabel: a.accountName,
              }))}
            />
            {sourceAccounts.length === 0 && (
              <p className="text-xs text-amber mt-1">
                ยังไม่มีบัญชีบันทึกไว้ — แจ้งเจ้าของร้านให้เพิ่มบัญชีในเมนู "บัญชีธนาคาร & หมวดหมู่" ก่อน
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">วันที่เบิก</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!canEdit}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal disabled:bg-paper disabled:text-inkSoft"
            />
          </div>
        </div>

        <div className="mb-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-inkSoft border-b border-paperLine">
                <th className="py-2 w-10">ลำดับ</th>
                <th className="py-2 w-40">หมวดหมู่</th>
                <th className="py-2">รายละเอียด</th>
                <th className="py-2 w-32 text-right">ยอดเงิน</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx} className="border-b border-paperLine/60">
                  <td className="py-1.5 font-nums text-inkSoft">{idx + 1}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      list="category-options"
                      value={l.categoryLabel}
                      onChange={(e) => updateLine(idx, "categoryLabel", e.target.value)}
                      placeholder="เลือก/พิมพ์หมวดหมู่"
                      disabled={!canEdit}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal disabled:bg-paper disabled:text-inkSoft"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      placeholder="รายละเอียด"
                      disabled={!canEdit}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal disabled:bg-paper disabled:text-inkSoft"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      step="0.01"
                      value={l.amount}
                      onChange={(e) => updateLine(idx, "amount", e.target.value)}
                      disabled={!canEdit}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm text-right font-nums focus:border-teal disabled:bg-paper disabled:text-inkSoft"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    {canEdit && (
                      <button onClick={() => removeLine(idx)} className="text-rust text-xs">
                        ลบ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c.id} value={c.label} />
            ))}
          </datalist>
        </div>

        {canEdit && (
          <button onClick={addLine} className="text-sm border border-paperLine rounded px-3 py-1.5 mb-4">
            + เพิ่มบรรทัด
          </button>
        )}

        <div>
          <label className="text-sm text-inkSoft block mb-1">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            disabled={!canEdit}
            className="w-full border border-paperLine rounded px-3 py-2 mb-4 focus:border-teal disabled:bg-paper disabled:text-inkSoft"
          />
        </div>

        <div className="flex justify-end mb-4">
          <div className="text-right">
            <div className="text-xs text-inkSoft">ยอดเบิกรวม</div>
            <div className="font-nums text-xl">{formatBaht(total)} บาท</div>
          </div>
        </div>

        {error && <p className="text-sm text-rust mb-3">{error}</p>}

        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy}
              className="bg-teal text-white rounded px-5 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {busy ? "กำลังบันทึก..." : "บันทึกใบเบิก"}
            </button>
            {!isNew && (
              <button onClick={handleDelete} className="border border-rust text-rust rounded px-5 py-2.5 text-sm">
                ลบใบเบิกนี้
              </button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
