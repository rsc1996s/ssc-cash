import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Loading from "../components/ui/Loading";
import EmptyState from "../components/ui/EmptyState";
import { formatBaht, formatDateTime } from "../lib/format";
import { ClipboardCheck } from "lucide-react";
import FormHeader from "../components/ui/FormHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";
import SearchPicker from "../components/ui/SearchPicker";
import useScopedCashData from "../hooks/useScopedCashData";
import { bangkokDate } from "../lib/businessDate";
import { isActiveFund } from "../lib/cashStatus";
import Sheet from "../components/ui/Sheet";

function closingKey(closing) {
  return `${closing.fundId}:${closing.businessDate}`;
}

export default function DailyClosings() {
  const { user, isOwner } = useAuth();
  const { confirm, toast } = useFeedback();
  const { funds: allFunds, loading: loadingFunds, error: fundsError } = useScopedCashData();
  const [closings, setClosings] = useState([]);
  const [loadingClosings, setLoadingClosings] = useState(isOwner);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fundId, setFundId] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState(null);
  const funds = useMemo(() => correction ? allFunds : allFunds.filter(isActiveFund), [allFunds, correction]);
  const [variance, setVariance] = useState(null);
  const [result, setResult] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!loadingFunds) setFundId((current) => funds.some((fund) => fund.id === current) ? current : funds[0]?.id || "");
  }, [funds, loadingFunds]);

  useEffect(() => {
    if (fundsError) setError("โหลดงบค่าใช้จ่ายไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์");
  }, [fundsError]);

  useEffect(() => {
    if (!isOwner) return undefined;
    const unsubscribe = onSnapshot(
      query(collection(db, "dailyClosings"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setClosings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadingClosings(false);
      },
      (loadError) => {
        console.error("โหลดประวัติปิดยอดไม่สำเร็จ:", loadError);
        setError("โหลดประวัติปิดยอดไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและสิทธิ์");
        setLoadingClosings(false);
      }
    );
    return () => unsubscribe();
  }, [isOwner]);

  const latestClosingIds = useMemo(() => {
    const latest = new Map();
    closings.forEach((closing) => {
      const key = closingKey(closing);
      if (!latest.has(key) || latest.get(key).revision < closing.revision) {
        latest.set(key, closing);
      }
    });
    return new Set([...latest.values()].map((closing) => closing.id));
  }, [closings]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setVariance(null);
    setResult(null);
    if (!fundId || !funds.some((fund) => fund.id === fundId)) {
      setError("กรุณาเลือกงบค่าใช้จ่าย");
      return;
    }
    if (countedCash === "" || !Number.isFinite(Number(countedCash)) || Number(countedCash) < 0) {
      setError("กรุณากรอกยอดเงินสดที่นับได้เป็นจำนวนตั้งแต่ 0 บาทขึ้นไป");
      document.getElementById("closing-counted-cash")?.focus();
      return;
    }

    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/.netlify/functions/close-daily-fund", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fundId,
          businessDate: correction?.businessDate || bangkokDate(),
          countedCash: Number(countedCash),
          reason,
          supersedesId: correction?.id || null,
        }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const submitError = new Error(responseData.message || "บันทึกปิดยอดไม่สำเร็จ");
        submitError.details = responseData.details;
        throw submitError;
      }
      setResult(responseData);
      setCountedCash("");
      setReason("");
      setCorrection(null);
      setFormOpen(false);
      toast("บันทึกปิดยอดแล้ว");
    } catch (submitError) {
      console.error("บันทึกปิดยอดไม่สำเร็จ:", submitError);
      if (submitError.details && Number.isFinite(submitError.details.difference)) {
        setVariance({
          expectedBalance: submitError.details.expectedBalance,
          difference: submitError.details.difference,
        });
        document.getElementById("closing-reason")?.focus();
      }
      setError(submitError.message || "บันทึกปิดยอดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  function startCorrection(closing) {
    setCorrection(closing);
    setFundId(closing.fundId);
    setCountedCash(String(closing.countedCash));
    setReason("");
    setVariance(null);
    setResult(null);
    setError("");
    setFormOpen(true);
  }

  const selectedFund = funds.find((fund) => fund.id === fundId);
  const latestClosings = closings.filter((closing) => latestClosingIds.has(closing.id));

  async function cancelForm() {
    if ((countedCash || reason.trim()) && !await confirm({
      title: "ยกเลิกการปิดยอด",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    setCountedCash("");
    setReason("");
    setCorrection(null);
    setError("");
    setFormOpen(false);
  }

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-xl font-bold">ปิดยอดเงินสดประจำวัน</h1>
        <p className="mt-1 text-sm text-inkSoft">
          ระบบเทียบยอดตั้งต้น เงินเติมงบค่าใช้จ่าย และรายการเงินสดที่อนุมัติแล้ว โดยไม่รวมรายการโอน
        </p>
      </div>

      <Button className="mb-4" onClick={() => { setResult(null); setFormOpen(true); }}>+ ปิดยอดเงินสด</Button>
      {result && (
        <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          บันทึกปิดยอดแล้ว · ระบบ {formatBaht(result.expectedBalance)} บาท · นับได้ {formatBaht(result.countedCash)} บาท · ส่วนต่าง {result.difference > 0 ? "+" : ""}{formatBaht(result.difference)} บาท
        </div>
      )}
      {!formOpen && error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
      <Sheet open={formOpen} title={correction ? "แก้ไขยอดปิดประจำวัน" : "ปิดยอดเงินสด"} onClose={cancelForm}
        header={<FormHeader title={correction ? "แก้ไขยอดปิดประจำวัน" : "ปิดยอดเงินสด"}
          onCancel={cancelForm} formId="daily-closing-form" saving={busy}
          saveDisabled={loadingFunds || funds.length === 0} saveLabel="บันทึก" />}>
        <form id="daily-closing-form" onSubmit={submit} className="space-y-4">
          {correction && (
            <div className="rounded-lg border border-warning/30 bg-warning-light p-3 text-sm text-warning">
              กำลังแก้ไขยอดวันที่ {correction.businessDate} · ครั้งที่ {correction.revision + 1}
              <button
                type="button"
                onClick={() => {
                  setCorrection(null);
                  setCountedCash("");
                  setReason("");
                  setError("");
                }}
                className="ml-2 underline"
              >
                ยกเลิกการแก้ไข
              </button>
            </div>
          )}

          <label className="block text-sm font-medium">
            งบค่าใช้จ่าย
            <SearchPicker
              value={fundId}
              onChange={setFundId}
              options={funds.map((fund) => ({ value: fund.id, label: fund.label }))}
              ariaLabel="งบค่าใช้จ่าย"
              disabled={loadingFunds || Boolean(correction)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-inkSoft">{correction ? "ยอดระบบ ณ เวลาปิดเดิม" : "วันที่ปิดยอด"}</p>
              <p className="mt-1 font-semibold text-blue-800">
                {correction
                  ? `${formatBaht(correction.expectedBalance)} บาท`
                  : `${bangkokDate()} · ${selectedFund?.label || "เลือกงบค่าใช้จ่าย"}`}
              </p>
            </div>
            <label className="block text-sm font-medium">
              เงินสดที่นับได้ (บาท)
              <Input
                id="closing-counted-cash"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={countedCash}
                onChange={(event) => setCountedCash(event.target.value)}
                className="mt-1"
                placeholder="0.00"
              />
            </label>
          </div>

          <label className="block text-sm font-medium">
            เหตุผล
            <Textarea
              id="closing-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1"
              placeholder="กรอกเมื่อยอดนับต่างจากระบบ หรือเมื่อแก้ไขยอดเดิม"
            />
          </label>

          {variance && (
            <div role="alert" className="rounded-lg border border-warning/40 bg-warning-light p-3 text-sm text-warning">
              ยอดระบบ {formatBaht(variance.expectedBalance)} บาท · ส่วนต่าง{" "}
              {variance.difference > 0 ? "+" : ""}{formatBaht(variance.difference)} บาท
              กรุณาระบุเหตุผลแล้วบันทึกอีกครั้ง
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
      </Sheet>

      {isOwner ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">รายการปิดยอดล่าสุด</h2>
          {loadingClosings ? (
            <Loading label="กำลังโหลดประวัติปิดยอด" />
          ) : latestClosings.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="ยังไม่มีรายการปิดยอด"
              description="รายการที่บันทึกแล้วจะแสดงที่นี่"
            />
          ) : (
            <div className="space-y-3">
              {latestClosings.slice(0, visibleCount).map((closing) => (
                <Card key={closing.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 break-words">
                    <p className="font-semibold">{closing.fundLabel} · {closing.businessDate}</p>
                    <p className="mt-1 text-sm text-inkSoft">
                      คาด <span className="font-nums">{formatBaht(closing.expectedBalance)}</span> · นับได้{" "}
                      <span className="font-nums">{formatBaht(closing.countedCash)}</span> ·{" "}
                      <span className="font-nums">{closing.difference > 0 ? "+" : ""}{formatBaht(closing.difference)}</span> บาท
                    </p>
                    <p className="mt-1 text-xs text-inkSoft">
                      ครั้งที่ {closing.revision} · {closing.createdByName} · {formatDateTime(closing.createdAt)}
                    </p>
                    {closing.reason && <p className="mt-1 text-sm">เหตุผล: {closing.reason}</p>}
                  </div>
                  <Button variant="secondary" className="w-full sm:w-auto" onClick={() => startCorrection(closing)}>
                    แก้ไขเป็นรายการใหม่
                  </Button>
                </Card>
              ))}
              {latestClosings.length > visibleCount && (
                <Button variant="secondary" className="w-full" onClick={() => setVisibleCount((count) => count + 10)}>
                  ดูเพิ่มเติม ({latestClosings.length - visibleCount} รายการ)
                </Button>
              )}
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-inkSoft">ประวัติการปิดยอดดูได้เฉพาะเจ้าของร้าน</p>
      )}
    </Layout>
  );
}
