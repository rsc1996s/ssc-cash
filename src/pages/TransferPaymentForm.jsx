import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  collection,
  doc,
  onSnapshot,
  getDoc,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { formatBaht } from "../lib/format";
import { nextDocNumber } from "../lib/counters";
import { lineTotal, renumberLines, remainingBalance } from "../lib/transfers";
import SearchPicker from "../components/ui/SearchPicker";
import AccountSearchPicker from "../components/AccountSearchPicker";
import { newAuditEvent, queueAuditEvent } from "../lib/audit";
import { useFeedback } from "../components/ui/FeedbackProvider";
import FormHeader from "../components/ui/FormHeader";
import Input from "../components/ui/Input";

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
  const { confirm, toast } = useFeedback();

  const [sourceAccounts, setSourceAccounts] = useState([]);
  const [payeeAccounts, setPayeeAccounts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [accountsReady, setAccountsReady] = useState(false);
  const [withdrawalsReady, setWithdrawalsReady] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [receivedValue, setReceivedValue] = useState("");
  const [receivedBaseline, setReceivedBaseline] = useState(null);
  const [receivedForId, setReceivedForId] = useState("");

  const [transferNo, setTransferNo] = useState(null);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [linkedWithdrawalRequestId, setLinkedWithdrawalRequestId] = useState("");
  const [lines, setLines] = useState([emptyLine(1)]);
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const paymentVersion = useRef(null);

  useEffect(() => {
    const failed = (err) => {
      console.error("โหลดข้อมูลโอนจ่ายไม่สำเร็จ:", err);
      setLoadError("โหลดข้อมูลโอนจ่ายไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
    };
    const unsub1 = onSnapshot(collection(db, "bankAccounts"), { includeMetadataChanges: true }, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSourceAccounts(all.filter((a) => a.side === "source"));
      setPayeeAccounts(all.filter((a) => a.side === "payee"));
      setAccountsReady(!snap.metadata.fromCache);
    }, failed);
    const unsub2 = onSnapshot(collection(db, "withdrawalRequests"), { includeMetadataChanges: true }, (snap) => {
      setWithdrawals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setWithdrawalsReady(!snap.metadata.fromCache);
    }, failed);
    const unsub3 = onSnapshot(collection(db, "transferPayments"), { includeMetadataChanges: true }, (snap) => {
      setAllPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPaymentsReady(!snap.metadata.fromCache);
    }, failed);
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
      if (paymentVersion.current !== null) return;
      paymentVersion.current = d.updatedAt?.toMillis?.() ?? 0;
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
  useEffect(() => {
    if (!linkedWithdrawal || receivedForId === linkedWithdrawal.id) return;
    const amount = linkedWithdrawal.receivedAmount ?? null;
    setReceivedBaseline(amount);
    setReceivedValue(amount === null ? "" : String(amount));
    setReceivedForId(linkedWithdrawal.id);
  }, [linkedWithdrawal, receivedForId]);
  const parsedReceived = receivedValue.trim() === "" ? null : Number(receivedValue);
  const remainingBeforeThis =
    linkedWithdrawal && parsedReceived !== null && Number.isFinite(parsedReceived)
      ? remainingBalance(
          { ...linkedWithdrawal, receivedAmount: parsedReceived },
          allPayments.filter((p) => p.id !== id)
        )
      : null;

  function selectWithdrawal(wId) {
    setDirty(true);
    setLinkedWithdrawalRequestId(wId);
    const w = withdrawals.find((x) => x.id === wId);
    if (w) setSourceAccountId(w.sourceAccountId);
  }

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

  async function handleSave() {
    setError("");
    if (!accountsReady || !withdrawalsReady || !paymentsReady || loadError) {
      setError("ยังโหลดข้อมูลจากเซิร์ฟเวอร์ไม่ครบ กรุณาตรวจสอบการเชื่อมต่อ");
      return;
    }
    const account = sourceAccounts.find((a) => a.id === sourceAccountId);
    if (!account) {
      setError("กรุณาเลือกบัญชีผู้ทำรายการ");
      document.getElementById("payment-source-account")?.focus();
      return;
    }
    if (!linkedWithdrawalRequestId) {
      setError("กรุณาเลือกใบเบิกที่จะตัดยอด");
      document.getElementById("payment-withdrawal-select")?.focus();
      return;
    }
    if (!linkedWithdrawal || receivedForId !== linkedWithdrawal.id || parsedReceived === null || !Number.isFinite(parsedReceived) ||
      parsedReceived < 0 || parsedReceived > 1000000000 || !/^\d+(\.\d{1,2})?$/.test(receivedValue.trim())) {
      setError("กรุณาระบุยอดรับเงินจริง 0–1,000,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง");
      document.getElementById("received-amount")?.focus();
      return;
    }
    const invalidLine = lines.findIndex((line) => {
      const amount = String(line.amount).trim();
      return !line.payeeAccountId || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 ||
        !payeeAccounts.some((payee) => payee.id === line.payeeAccountId);
    });
    if (invalidLine !== -1) {
      setError(`กรุณาตรวจสอบบัญชีปลายทางและยอดเงินของรายการที่ ${invalidLine + 1}`);
      document.getElementById(window.matchMedia("(min-width: 768px)").matches
        ? `payment-payee-desktop-${invalidLine}` : `payment-payee-mobile-${invalidLine}`)?.focus();
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
      setError("กรุณาเพิ่มอย่างน้อย 1 รายการ พร้อมเลือกบัญชีปลายทาง");
      document.getElementById(
        window.matchMedia("(min-width: 768px)").matches
          ? "payment-payee-desktop-0"
          : "payment-payee-mobile-0"
      )?.focus();
      return;
    }

    if (parsedReceived !== receivedBaseline && !await confirm({
      title: "ยืนยันยอดรับเงินจริง",
      description: `ใบเบิก ${linkedWithdrawal.requestNo}: ${receivedBaseline === null ? "ยังไม่ได้ระบุ" : `${formatBaht(receivedBaseline)} บาท`} → ${formatBaht(parsedReceived)} บาท\nยอดนี้ใช้คำนวณยอดคงเหลือของใบโอนทุกใบ`,
      confirmLabel: "ยืนยันยอดรับจริง",
    })) return;
    setBusy(true);
    try {
      const sourceAccountLabel = `${account.bankName} · ${account.accountNumber} (${account.accountName})`;
      const genNo = isNew ? await nextDocNumber("transferPayments", "TP") : null;
      const paymentRef = isNew ? doc(collection(db, "transferPayments")) : doc(db, "transferPayments", id);
      const withdrawalRef = doc(db, "withdrawalRequests", linkedWithdrawalRequestId);
      await runTransaction(db, async (transaction) => {
        const withdrawalSnap = await transaction.get(withdrawalRef);
        const paymentSnap = isNew ? null : await transaction.get(paymentRef);
        if (!withdrawalSnap.exists() || (!isNew && !paymentSnap.exists())) throw new Error("ไม่พบเอกสาร กรุณาโหลดหน้าใหม่");
        if (paymentSnap && (paymentSnap.data().updatedAt?.toMillis?.() ?? 0) !== paymentVersion.current) {
          throw new Error("ใบโอนจ่ายถูกแก้ไขโดยผู้อื่น กรุณาโหลดหน้าใหม่");
        }
        const current = withdrawalSnap.data();
        if ((current.receivedAmount ?? null) !== receivedBaseline || current.sourceAccountId !== sourceAccountId) {
          throw new Error("ยอดรับจริงหรือบัญชีผู้ทำรายการถูกแก้ไขโดยผู้อื่น กรุณาโหลดหน้าใหม่");
        }
        if (parsedReceived !== receivedBaseline) {
          const audit = newAuditEvent({
            actorUid: user.uid, actorName: profile?.name || user.email,
            action: "withdrawal-received-changed", targetCollection: "withdrawalRequests",
            targetId: linkedWithdrawalRequestId,
            before: { receivedAmount: receivedBaseline }, after: { receivedAmount: parsedReceived },
          });
          transaction.update(withdrawalRef, { receivedAmount: parsedReceived, auditLogId: audit.ref.id, updatedAt: serverTimestamp() });
          queueAuditEvent(transaction, audit);
        }
        const fields = {
          sourceAccountId,
          sourceAccountLabel,
          linkedWithdrawalRequestId,
          linkedWithdrawalRequestNo: current.requestNo || "",
          lines: cleanLines,
          updatedAt: serverTimestamp(),
        };
        if (isNew) transaction.set(paymentRef, {
          ...fields, transferNo: genNo, createdAt: serverTimestamp(),
          createdBy: user.uid, createdByName: profile?.name || user.email,
        });
        else transaction.update(paymentRef, fields);
      });
      toast(isNew ? "บันทึกใบโอนจ่ายแล้ว" : "บันทึกการแก้ไขใบโอนจ่ายแล้ว");
      navigate("/transfers");
    } catch (err) {
      console.error(err);
      setError(err.message || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
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
      title: "ลบใบโอนจ่าย",
      description: "ลบใบโอนจ่ายนี้ทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้",
      confirmLabel: "ลบใบโอนจ่าย",
      danger: true,
    })) return;
    setBusy(true);
    setError("");
    try {
      const paymentRef = doc(db, "transferPayments", id);
      const snapshot = await getDoc(paymentRef);
      if (!snapshot.exists()) {
        throw new Error("ไม่พบใบโอนจ่ายที่ต้องการลบ");
      }
      const audit = newAuditEvent({
        id: `delete-payment-${id}`,
        actorUid: user.uid,
        actorName: profile?.name || user.email,
        action: "transfer-payment-deleted",
        targetCollection: "transferPayments",
        targetId: id,
        before: snapshot.data(),
        after: null,
      });
      const batch = writeBatch(db);
      batch.delete(paymentRef);
      queueAuditEvent(batch, audit);
      await batch.commit();
      navigate("/transfers");
    } catch (err) {
      console.error(err);
      setError("ลบใบโอนจ่ายไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองใหม่");
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
  const overLimit = remainingBeforeThis != null && total > remainingBeforeThis;
  const withdrawalOptions = availableWithdrawals.map((withdrawal) => {
    const remain = remainingBalance(withdrawal, allPayments.filter((payment) => payment.id !== id));
    return {
      value: withdrawal.id,
      label: withdrawal.requestNo,
      sublabel: `${withdrawal.date || ""} · ขอเบิก ${formatBaht(withdrawal.totalAmount ?? lineTotal(withdrawal.lines))} บาท · ${remain === null ? "ยังไม่ระบุยอดรับจริง" : `คงเหลือ ${formatBaht(remain)} บาท`}`,
      searchText: `${withdrawal.requestNo} ${withdrawal.date || ""} ${withdrawal.totalAmount ?? lineTotal(withdrawal.lines)}`,
    };
  });

  return (
    <Layout>
      <div className="bg-white border border-paperLine rounded-lg p-6">
        <FormHeader
          title={isNew ? "สร้างใบโอนจ่ายใหม่" : `แก้ไขใบโอนจ่าย ${transferNo}`}
          onCancel={cancelForm}
          onSave={handleSave}
          saving={busy}
          saveDisabled={!accountsReady || !withdrawalsReady || !paymentsReady || Boolean(loadError)}
          saveLabel="บันทึก"
        />
        {!isNew && (
          <div className="mb-4 flex justify-end">
            <Link to={`/transfers/payments/${id}/print`} target="_blank" className="text-sm border border-paperLine rounded px-3 py-1.5">
              พิมพ์ / PDF
            </Link>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm text-inkSoft block mb-1">โอนจากบัญชีผู้ทำรายการ</label>
            <AccountSearchPicker
              id="payment-source-account"
              side="source"
              accounts={sourceAccounts}
              ariaLabel="บัญชีผู้ทำรายการ"
              value={sourceAccountId}
              onChange={(v) => {
                setDirty(true);
                setSourceAccountId(v);
                setLinkedWithdrawalRequestId("");
              }}
              placeholder="— เลือกบัญชี —"
            />
          </div>
          <div>
            <label className="text-sm text-inkSoft block mb-1">ตัดยอดกับใบเบิกเลขที่</label>
            <SearchPicker
              id="payment-withdrawal-select"
              ariaLabel="ใบเบิกที่ผูก"
              value={linkedWithdrawalRequestId}
              onChange={selectWithdrawal}
              placeholder="— เลือกใบเบิก —"
              options={withdrawalOptions}
            />
          </div>
        </div>

        {loadError && <p role="alert" className="mb-3 text-sm text-danger">{loadError}</p>}
        {linkedWithdrawal && (
          <div className="mb-4 space-y-3 rounded-lg bg-paper p-3">
            <label className="block text-sm">ยอดรับเงินจริงเข้าบัญชีผู้ทำรายการ (บาท)
              <Input id="received-amount" type="number" min="0" step="0.01" value={receivedValue}
                onChange={(event) => { setReceivedValue(event.target.value); setDirty(true); }} />
            </label>
            <p className="text-sm text-inkSoft">คงเหลือก่อนใบนี้: {remainingBeforeThis === null ? "กรุณาระบุยอดรับจริง" : `${formatBaht(remainingBeforeThis)} บาท`}</p>
            {remainingBeforeThis !== null && <p className="text-sm font-semibold">คงเหลือหลังใบนี้: {formatBaht(remainingBeforeThis - lineTotal(lines))} บาท</p>}
            <div className="text-sm">
              <p className="font-semibold">ใบโอนจ่ายที่ตัดยอดแล้ว</p>
              {allPayments.filter((payment) => payment.id !== id && payment.linkedWithdrawalRequestId === linkedWithdrawal.id).length === 0
                ? <p className="text-inkSoft">ยังไม่มีใบโอนจ่ายอื่น</p>
                : allPayments.filter((payment) => payment.id !== id && payment.linkedWithdrawalRequestId === linkedWithdrawal.id).map((payment) => (
                  <div key={payment.id} className="mt-2">
                    <Link to={`/transfers/payments/${payment.id}`} className="text-blue-700 underline">{payment.transferNo}</Link>
                    {" · "}{formatBaht(lineTotal(payment.lines))} บาท
                    <ul>{(payment.lines || []).map((line, index) => <li key={index} className="text-xs text-inkSoft">{line.transferDate} · {line.payeeAccountLabel} · {formatBaht(line.amount)} บาท</li>)}</ul>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* มือถือ: การ์ดแนวตั้งต่อ 1 บรรทัด */}
        <div className="md:hidden space-y-3 mb-3">
          {lines.map((l, idx) => (
            <div key={idx} className="border border-paperLine rounded-lg p-3 bg-paper/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-nums text-inkSoft">รายการที่ {idx + 1}</span>
                <button onClick={() => removeLine(idx)} className="text-danger text-xs px-2 py-1 -mr-2">
                  ลบ
                </button>
              </div>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={l.transferDate}
                  onChange={(e) => updateLine(idx, "transferDate", e.target.value)}
                  className="w-full border border-paperLine rounded px-3 py-2.5 text-sm focus:border-primary"
                />
                <AccountSearchPicker
                  id={`payment-payee-mobile-${idx}`}
                  side="payee"
                  accounts={payeeAccounts}
                  ariaLabel={`บัญชีปลายทางรายการที่ ${idx + 1}`}
                  value={l.payeeAccountId}
                  onChange={(v) => updateLine(idx, "payeeAccountId", v)}
                  placeholder="— เลือกบัญชีปลายทาง —"
                />
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={l.amount}
                  onChange={(e) => updateLine(idx, "amount", e.target.value)}
                  className="w-full border border-paperLine rounded px-3 py-2.5 text-sm text-right font-nums focus:border-primary"
                  placeholder="ยอดเงิน"
                />
                <Input
                  value={l.note}
                  onChange={(e) => updateLine(idx, "note", e.target.value)}
                  placeholder="หมายเหตุ"
                  className="w-full border border-paperLine rounded px-3 py-2.5 text-sm focus:border-primary"
                />
              </div>
            </div>
          ))}
          {payeeAccounts.length === 0 && (
            <p className="text-xs text-warning">
              ยังไม่มีบัญชีปลายทางบันทึกไว้ —{" "}
              <Link to="/settings/bank-accounts" className="underline">
                เพิ่มบัญชีก่อน
              </Link>
            </p>
          )}
        </div>

        {/* จอกลาง/ใหญ่: ตารางปกติ */}
        <div className="hidden md:block mb-2 overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs text-inkSoft border-b border-paperLine">
                <th className="py-2 w-10">ลำดับ</th>
                <th className="py-2 w-36">วันที่โอน</th>
                <th className="py-2">บัญชีปลายทาง</th>
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
                    <Input
                      type="date"
                      value={l.transferDate}
                      onChange={(e) => updateLine(idx, "transferDate", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-primary"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <AccountSearchPicker
                      id={`payment-payee-desktop-${idx}`}
                      side="payee"
                      accounts={payeeAccounts}
                      ariaLabel={`บัญชีปลายทางรายการที่ ${idx + 1}`}
                      value={l.payeeAccountId}
                      onChange={(v) => updateLine(idx, "payeeAccountId", v)}
                      placeholder="— เลือกบัญชีปลายทาง —"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={l.amount}
                      onChange={(e) => updateLine(idx, "amount", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm text-right font-nums focus:border-primary"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={l.note}
                      onChange={(e) => updateLine(idx, "note", e.target.value)}
                      className="w-full border border-paperLine rounded px-2 py-1.5 text-sm focus:border-primary"
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    <button onClick={() => removeLine(idx)} className="text-danger text-xs">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payeeAccounts.length === 0 && (
            <p className="text-xs text-warning mt-1">
              ยังไม่มีบัญชีปลายทางบันทึกไว้ —{" "}
              <Link to="/settings/bank-accounts" className="underline">
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
          <p className="text-sm text-warning mb-3 text-right">
            * ยอดรวมเกินยอดคงเหลือของใบเบิกนี้ ({formatBaht(remainingBeforeThis)} บาท) กรุณาตรวจสอบก่อนบันทึก
          </p>
        )}

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="flex justify-end">
          {!isNew && (
            <button onClick={handleDelete} className="border border-danger text-danger rounded px-5 py-2.5 text-sm">
              ลบใบนี้
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
