import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht, formatDateTime } from "../lib/format";
import { nextDocNumber } from "../lib/counters";
import { lineTotal, renumberLines, transferredAgainst } from "../lib/transfers";
import AccountSearchPicker from "../components/AccountSearchPicker";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import { useFeedback } from "../components/ui/FeedbackProvider";
import FormHeader from "../components/ui/FormHeader";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { normalizeSearchText } from "../components/ui/searchText";
import SearchPicker from "../components/ui/SearchPicker";
import Sheet from "../components/ui/Sheet";
import WithdrawalRequestDocument from "../components/WithdrawalRequestDocument";
import Button from "../components/ui/Button";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function emptyLine(n) {
  return { lineNo: n, categoryLabel: "", description: "", amount: "" };
}

function timestampValue(value) {
  if (!value) return null;
  const timestamp = value.toMillis?.() ?? new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export default function WithdrawalRequestForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { user, profile, isOwner } = useAuth();
  const { confirm, toast } = useFeedback();

  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [requestNo, setRequestNo] = useState(null);
  const [createdBy, setCreatedBy] = useState(null);
  const [createdByName, setCreatedByName] = useState("");
  const [createdAt, setCreatedAt] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([emptyLine(1)]);
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [previousRequests, setPreviousRequests] = useState([]);
  const [copySourceId, setCopySourceId] = useState("");
  const [transferPayments, setTransferPayments] = useState([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [lineEditDraft, setLineEditDraft] = useState(null);

  const canEdit = isNew || isOwner || createdBy === user.uid;
  const categoryOptions = categories.map((category) => ({
    value: category.label,
    label: category.label,
  }));

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
    if (!isNew) return undefined;
    const requestsQuery = isOwner
      ? collection(db, "withdrawalRequests")
      : query(collection(db, "withdrawalRequests"), where("createdBy", "==", user.uid));
    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => setPreviousRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (loadError) => {
        console.error("โหลดใบเบิกก่อนหน้าไม่สำเร็จ:", loadError);
        setError("โหลดใบเบิกก่อนหน้าไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
      }
    );
    return () => unsubscribe();
  }, [isNew, isOwner, user.uid]);

  useEffect(() => {
    if (!isOwner) {
      setPaymentsLoaded(true);
      setTransferPayments([]);
      return undefined;
    }
    setPaymentsLoaded(false);
    const unsubscribe = onSnapshot(
      collection(db, "transferPayments"),
      (snapshot) => {
        setTransferPayments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setPaymentsLoaded(true);
      },
      (loadError) => {
        console.error("โหลดใบโอนจ่ายสำหรับตรวจสอบยอดไม่สำเร็จ:", loadError);
        setError("โหลดข้อมูลยอดโอนจ่ายไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก");
        setPaymentsLoaded(false);
      }
    );
    return () => unsubscribe();
  }, [isOwner]);

  useEffect(() => {
    if (isNew) return;
    const unsub = onSnapshot(doc(db, "withdrawalRequests", id), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setRequestNo(d.requestNo);
      setCreatedBy(d.createdBy || null);
      setCreatedByName(d.createdByName || "");
      setCreatedAt(d.createdAt || null);
      setUpdatedAt(d.updatedAt || null);
      setOriginalTotal(d.totalAmount ?? lineTotal(d.lines));
      setSourceAccountId(d.sourceAccountId);
      setDate(d.date);
      setNote(d.note || "");
      setLines(d.lines && d.lines.length ? d.lines : [emptyLine(1)]);
      setLoaded(true);
    });
    return () => unsub();
  }, [id, isNew]);

  function updateLine(idx, field, value) {
    setDirty(true);
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setDirty(true);
    setLines((ls) => [...ls, emptyLine(ls.length + 1)]);
  }

  function removeLine(idx) {
    setDirty(true);
    setLines((ls) => renumberLines(ls.filter((_, i) => i !== idx)));
  }

  function startLineEdit(index) {
    setEditingLineIndex(index);
    setLineEditDraft({ ...lines[index] });
  }

  async function cancelLineEdit() {
    const original = editingLineIndex === null ? null : lines[editingLineIndex];
    const changed = original && lineEditDraft && Object.keys(original).some((key) =>
      String(original[key] ?? "") !== String(lineEditDraft[key] ?? "")
    );
    if (changed && !await confirm({
      title: "ยกเลิกการแก้ไขรายการ",
      description: "ข้อมูลที่แก้ไขแต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setEditingLineIndex(null);
    setLineEditDraft(null);
  }

  function saveLineEdit(event) {
    event.preventDefault();
    if (editingLineIndex === null || !lineEditDraft) return;
    setLines((current) => current.map((line, index) =>
      index === editingLineIndex ? { ...lineEditDraft, lineNo: line.lineNo } : line
    ));
    setDirty(true);
    setEditingLineIndex(null);
    setLineEditDraft(null);
  }

  async function selectOrAddCategory(value, index, closePicker, onSelect = (next) => updateLine(index, "categoryLabel", next)) {
    const label = value.trim();
    if (!label) return;
    const existing = categories.find((category) =>
      normalizeSearchText(category.label).replace(/\s+/g, "") ===
      normalizeSearchText(label).replace(/\s+/g, "")
    );
    if (existing) {
      onSelect(existing.label);
      closePicker();
      return;
    }
    if (!isOwner) {
      onSelect(label);
      closePicker();
      return;
    }
    try {
      await addDoc(collection(db, "transferCategories"), {
        label,
        createdAt: serverTimestamp(),
      });
      onSelect(label);
      toast("เพิ่มหมวดหมู่เข้าคลังแล้ว");
      closePicker();
    } catch (addError) {
      console.error("เพิ่มหมวดหมู่ไม่สำเร็จ:", addError);
      setError("เพิ่มหมวดหมู่เข้าคลังไม่สำเร็จ กรุณาลองใหม่");
    }
  }

  function categoryPicker(
    index,
    value = lines[index].categoryLabel,
    onValueChange = (next) => updateLine(index, "categoryLabel", next),
    onSelect = onValueChange
  ) {
    return (
      <SearchPicker
        value={value}
        onChange={onValueChange}
        options={categoryOptions}
        ariaLabel={`หมวดหมู่รายการที่ ${index + 1}`}
        placeholder="เลือกหมวดหมู่"
        helperText={isOwner ? "พิมพ์ชื่อใหม่เพื่อเพิ่มเข้าคลัง" : undefined}
        isExactMatch={(query, options) => {
          const normalized = normalizeSearchText(query).replace(/\s/g, "");
          return options.some((option) =>
            normalizeSearchText(option.label).replace(/\s/g, "") === normalized
          );
        }}
        disabled={!canEdit}
        createAction={(query, { close }) => (
          <button
            type="button"
            onClick={() => selectOrAddCategory(query, index, close, onSelect)}
            className="min-h-12 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-left text-sm font-medium text-blue-800"
          >
            {isOwner ? `+ เพิ่ม “${query}”` : `+ ใช้ “${query}” (รอเจ้าของเพิ่มเข้าคลัง)`}
          </button>
        )}
      />
    );
  }

  async function handleSave() {
    setError("");
    const account = sourceAccounts.find((a) => a.id === sourceAccountId);
    if (!account) {
      setError("กรุณาเลือกบัญชี A (บัญชีต้นทาง)");
      document.getElementById("withdrawal-source-account")?.focus();
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
      document.getElementById(
        window.matchMedia("(min-width: 768px)").matches
          ? "withdrawal-line-description-desktop"
          : "withdrawal-line-edit-0"
      )?.focus();
      return;
    }
    const newTotal = lineTotal(cleanLines);
    if (!isNew && isOwner) {
      if (!paymentsLoaded) {
        setError("กำลังโหลดข้อมูลยอดโอนจ่าย กรุณารอสักครู่แล้วลองบันทึกอีกครั้ง");
        return;
      }
      const linked = transferPayments.filter((payment) => payment.linkedWithdrawalRequestId === id);
      if (linked.length > 0) {
        const paid = transferredAgainst(id, transferPayments);
        const remaining = newTotal - paid;
        const lowerThanPaid = newTotal < paid;
        const confirmed = await confirm({
          title: "ยืนยันแก้ไขใบเบิกที่มีการโอนจ่าย",
          description: `ยอดโอนจ่ายแล้ว ${formatBaht(paid)} บาท\nยอดรวมเดิม ${formatBaht(originalTotal)} บาท → ใหม่ ${formatBaht(newTotal)} บาท\nคงเหลือใหม่ ${formatBaht(remaining)} บาท${lowerThanPaid ? "\n\nคำเตือน: ยอดรวมใหม่ต่ำกว่ายอดที่โอนจ่ายแล้ว ยอดคงเหลือจะติดลบ แต่ยังสามารถบันทึกได้" : ""}`,
          confirmLabel: "ยืนยันการแก้ไข",
          danger: lowerThanPaid,
        });
        if (!confirmed) return;
      }
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
          totalAmount: newTotal,
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
          totalAmount: newTotal,
          updatedAt: serverTimestamp(),
        });
      }
      toast(isNew ? "บันทึกใบเบิกแล้ว" : "บันทึกการแก้ไขใบเบิกแล้ว");
      navigate("/transfers");
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function cancelForm() {
    if (dirty && !await confirm({
      title: "ยกเลิกการแก้ไข",
      description: "ข้อมูลที่เปลี่ยนแปลงแต่ยังไม่บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    navigate("/transfers");
  }

  async function handleDelete() {
    if (!await confirm({
      title: "ลบใบเบิก",
      description: "ลบใบเบิกนี้ทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้",
      confirmLabel: "ลบใบเบิก",
      danger: true,
    })) return;
    setBusy(true);
    setError("");
    try {
      const withdrawalRef = doc(db, "withdrawalRequests", id);
      const snapshot = await getDoc(withdrawalRef);
      if (!snapshot.exists()) {
        throw new Error("ไม่พบใบเบิกที่ต้องการลบ");
      }
      const audit = newAuditEvent({
        id: `delete-withdrawal-${id}`,
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "withdrawal-deleted",
        targetCollection: "withdrawalRequests",
        targetId: id,
        before: snapshot.data(),
        after: null,
      });
      const batch = writeBatch(db);
      batch.delete(withdrawalRef);
      queueAuditEvent(batch, audit);
      await batch.commit();
      navigate("/transfers");
    } catch (err) {
      console.error(err);
      setError("ลบใบเบิกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return (
      <Layout>
        <p className="text-sm text-inkSoft">กำลังโหลด...</p>
      </Layout>
    );
  }

  const total = lineTotal(lines);
  const sourceAccount = sourceAccounts.find((account) => account.id === sourceAccountId);
  const previewRequest = {
    id: id || "preview",
    requestNo: requestNo || "ตัวอย่าง",
    sourceAccountLabel: sourceAccount
      ? `${sourceAccount.bankName} · ${sourceAccount.accountNumber} (${sourceAccount.accountName})`
      : "",
    date,
    note,
    lines: lines.map((line, index) => ({ ...line, lineNo: index + 1 })),
    totalAmount: total,
    createdAt,
    updatedAt,
    createdByName: createdByName || profile?.name || "",
  };
  const isModified = timestampValue(updatedAt) !== null &&
    timestampValue(createdAt) !== null &&
    Math.abs(timestampValue(updatedAt) - timestampValue(createdAt)) > 1000;
  const previousRequestOptions = [...previousRequests]
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .map((request) => ({
      value: request.id,
      label: request.requestNo || request.id,
      sublabel: `${request.date || ""} · ${formatBaht(request.totalAmount ?? lineTotal(request.lines))} บาท`,
      searchText: `${request.requestNo || ""} ${request.date || ""} ${request.totalAmount ?? lineTotal(request.lines)}`,
    }));

  function copyPreviousRequest(requestId) {
    const request = previousRequests.find((item) => item.id === requestId);
    if (!request) return;
    setLines(renumberLines((request.lines || []).map((line, index) => ({
      lineNo: index + 1,
      categoryLabel: line.categoryLabel || "",
      description: line.description || "",
      amount: "",
    }))));
    setCopySourceId(requestId);
    setDirty(true);
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl rounded-xl border border-paperLine bg-white p-4 shadow-sm sm:p-6">
        {canEdit ? (
          <FormHeader
            title={isNew ? "สร้างใบเบิกเงินโอนใหม่" : `แก้ไขใบเบิก ${requestNo}`}
            onCancel={cancelForm}
            onSave={handleSave}
            saving={busy}
            saveDisabled={!isNew && isOwner && !paymentsLoaded}
            saveLabel="บันทึก"
          />
        ) : (
          <div className="mb-4 flex min-h-11 items-center gap-3">
            <button onClick={cancelForm} className="text-sm text-inkSoft">← กลับ</button>
            <h1 className="text-xl font-semibold">ดูใบเบิก {requestNo}</h1>
          </div>
        )}
        {!isNew && (
          <div className="mb-4 flex justify-end">
            <Link to={`/transfers/withdrawals/${id}/print`} target="_blank" className="text-sm border border-paperLine rounded px-3 py-1.5">
              พิมพ์ / PDF
            </Link>
          </div>
        )}

        {!isNew && !canEdit && (
          <p className="text-xs text-amber bg-amber-light border border-amber/40 rounded px-3 py-2 mb-4">
            ใบเบิกนี้สร้างโดย {createdByName} — ดูได้อย่างเดียว แก้ไข/ลบได้เฉพาะผู้สร้างเองหรือเจ้าของร้าน
          </p>
        )}

        {!isNew && (
          <div className="mb-4 rounded-lg bg-paper px-3 py-2 text-sm text-inkSoft">
            สร้างเมื่อ {createdAt ? formatDateTime(createdAt) : "-"} โดย {createdByName || "-"}
            {" · "}
            {isModified ? `แก้ไขล่าสุด ${formatDateTime(updatedAt)}` : "แก้ไขล่าสุด: ไม่มี"}
            {isModified && <span className="ml-2 font-semibold text-amber">มีการแก้ไข</span>}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          {isNew && (
            <label className="min-w-0 flex-1 text-sm font-medium">
              คัดลอกจากใบเบิกก่อนหน้า
              <SearchPicker
                value={copySourceId}
                onChange={copyPreviousRequest}
                options={previousRequestOptions}
                placeholder="เลือกใบเบิกเพื่อคัดลอกรายการ"
                ariaLabel="ใบเบิกก่อนหน้า"
              />
            </label>
          )}
          {!isNew && (
            <Button
              variant="secondary"
              onClick={() => window.open(`/transfers/withdrawals/${id}/print`, "_blank", "noopener,noreferrer")}
              className="text-sm"
            >
              พิมพ์ / PDF
            </Button>
          )}
          <Button variant="secondary" onClick={() => setPreviewOpen(true)} className="text-sm">
            ดูตัวอย่างรายงาน
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">บัญชีต้นทาง</label>
            <AccountSearchPicker
              id="withdrawal-source-account"
              side="source"
              accounts={sourceAccounts}
              ariaLabel="บัญชีต้นทาง"
              value={sourceAccountId}
              onChange={(value) => {
                setDirty(true);
                setSourceAccountId(value);
              }}
              disabled={!canEdit}
              placeholder="— เลือกบัญชี —"
            />
            {sourceAccounts.length === 0 && (
              <p className="text-xs text-amber mt-1">
                ยังไม่มีบัญชีต้นทางในคลัง — กรุณาติดต่อเจ้าของร้านให้เพิ่มบัญชีก่อน
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">วันที่</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDirty(true);
                setDate(e.target.value);
              }}
              disabled={!canEdit}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal disabled:bg-paper disabled:text-inkSoft"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-sm font-medium">หมายเหตุ</label>
          <Textarea
            value={note}
            onChange={(event) => {
              setDirty(true);
              setNote(event.target.value);
            }}
            rows={2}
            disabled={!canEdit}
            placeholder="หมายเหตุ (ถ้ามี)"
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">รายการค่าใช้จ่าย</h2>
          {canEdit && (
            <Button variant="secondary" onClick={addLine} className="px-3">
              + เพิ่มรายการ
            </Button>
          )}
        </div>

        <div className="mb-3 space-y-3 lg:hidden">
          {lines.map((l, idx) => (
            <div key={idx} className="rounded-lg border border-paperLine bg-paper/40 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">ลำดับ {idx + 1}</span>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      id={idx === 0 ? "withdrawal-line-edit-0" : undefined}
                      type="button"
                      variant="secondary"
                      onClick={() => startLineEdit(idx)}
                      className="px-3"
                    >
                      แก้ไข
                    </Button>
                    <Button type="button" variant="danger" onClick={() => removeLine(idx)} className="px-3">
                      ลบ
                    </Button>
                  </div>
                )}
              </div>
              <p className="break-words text-sm font-medium">{l.categoryLabel || "ไม่ระบุหมวด"}</p>
              <p className="mt-1 break-words text-sm text-inkSoft">{l.description || "—"}</p>
              <p className="mt-2 text-right font-nums text-base font-semibold">{formatBaht(l.amount)} บาท</p>
            </div>
          ))}
        </div>

        <div className="mb-3 hidden lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-paperLine text-left text-xs text-inkSoft">
                <th className="w-16 py-2">ลำดับ</th>
                <th className="w-56 py-2">รายการ (หมวด)</th>
                <th className="py-2">รายละเอียด</th>
                <th className="w-36 py-2 text-right">จำนวนเงิน</th>
                {canEdit && <th className="w-28 py-2 text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={idx} className="border-b border-paperLine/60">
                  <td className="py-1.5 font-nums text-inkSoft">{idx + 1}</td>
                  <td className="py-1.5 pr-2">
                    {categoryPicker(idx)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      id={idx === 0 ? "withdrawal-line-description-desktop" : undefined}
                      value={l.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      placeholder="รายละเอียด"
                      disabled={!canEdit}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-teal disabled:bg-paper disabled:text-inkSoft"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={l.amount}
                      onChange={(e) => updateLine(idx, "amount", e.target.value)}
                      disabled={!canEdit}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm text-right font-nums focus:border-teal disabled:bg-paper disabled:text-inkSoft"
                      placeholder="0.00"
                    />
                  </td>
                  {canEdit && <td className="py-1.5 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="secondary" onClick={() => removeLine(idx)} className="px-2">ลบ</Button>
                      </div>
                    )}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4 flex justify-end">
          <div className="rounded-lg bg-blue-50 px-4 py-3 text-right">
            <div className="text-sm font-semibold">ยอดรวมรอชำระ</div>
            <div className="font-nums text-xl font-bold">{formatBaht(total)} บาท</div>
          </div>
        </div>

        {error && <p className="text-sm text-rust mb-3">{error}</p>}

        {canEdit && (
          <div className="flex justify-end">
            {!isNew && (
              <button onClick={handleDelete} className="border border-rust text-rust rounded px-5 py-2.5 text-sm">
                ลบใบเบิกนี้
              </button>
            )}
          </div>
        )}
      </div>
      <Sheet
        open={editingLineIndex !== null}
        title="แก้ไขรายการ"
        onClose={cancelLineEdit}
        header={
          <FormHeader
            title={`แก้ไขรายการที่ ${(editingLineIndex ?? 0) + 1}`}
            onCancel={cancelLineEdit}
            formId="withdrawal-line-form"
            saveLabel="บันทึกรายการ"
          />
        }
      >
        {lineEditDraft && editingLineIndex !== null && (
          <form id="withdrawal-line-form" onSubmit={saveLineEdit} className="space-y-3">
            <label className="block text-sm font-medium">
              รายการ (หมวด)
              {categoryPicker(
                editingLineIndex,
                lineEditDraft.categoryLabel,
                (value) => setLineEditDraft((draft) => ({ ...draft, categoryLabel: value })),
                (value) => setLineEditDraft((draft) => ({ ...draft, categoryLabel: value }))
              )}
            </label>
            <label className="block text-sm font-medium">
              รายละเอียด
              <Input
                id="withdrawal-line-description-mobile"
                value={lineEditDraft.description}
                onChange={(event) => setLineEditDraft((draft) => ({ ...draft, description: event.target.value }))}
                placeholder="รายละเอียด"
                className="mt-1"
              />
            </label>
            <label className="block text-sm font-medium">
              จำนวนเงิน
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={lineEditDraft.amount}
                onChange={(event) => setLineEditDraft((draft) => ({ ...draft, amount: event.target.value }))}
                placeholder="0.00"
                className="mt-1 text-right font-nums"
              />
            </label>
          </form>
        )}
      </Sheet>
      <Sheet
        open={previewOpen}
        title="ตัวอย่างรายงานใบเบิก"
        onClose={() => setPreviewOpen(false)}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Button variant={groupByCategory ? "primary" : "secondary"} onClick={() => setGroupByCategory(false)}>
            เรียงตามลำดับ
          </Button>
          <Button variant={groupByCategory ? "secondary" : "primary"} onClick={() => setGroupByCategory(true)}>
            จัดกลุ่มตามหมวดพร้อมยอดย่อย
          </Button>
          <Button variant="secondary" aria-pressed={showNote} onClick={() => setShowNote((value) => !value)}>
            {showNote ? "ซ่อนหมายเหตุ" : "แสดงหมายเหตุ"}
          </Button>
        </div>
        <WithdrawalRequestDocument
          request={previewRequest}
          isOwner={isOwner}
          payments={transferPayments}
          groupByCategory={groupByCategory}
          showNote={showNote}
        />
      </Sheet>
    </Layout>
  );
}
