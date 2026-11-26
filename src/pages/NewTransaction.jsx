import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { fileToCompressedDataUrl, approxKb } from "../lib/image";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import FormHeader from "../components/ui/FormHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";
import SearchPicker from "../components/ui/SearchPicker";
import { formatDate } from "../lib/format";
import { evidenceSizeValid } from "../lib/evidence";
import useReceiptPhotos from "../components/useReceiptPhotos";
import ReceiptPhotoFields from "../components/ReceiptPhotoFields";
import useScopedCashData from "../hooks/useScopedCashData";
import useCategories from "../hooks/useCategories";
import { isActiveFund } from "../lib/cashStatus";

const TOTAL_PHOTO_KB_WARNING = 700;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const emptyForm = {
  fundId: "",
  transactionDate: localDateString(),
  type: "expense",
  amount: "",
  withdrawnAmount: "",
  itemDescription: "",
  changeAmount: "",
  paymentMethod: "cash",
  category: "",
  note: "",
};

export default function NewTransaction() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { confirm, toast } = useFeedback();
  const [form, setForm] = useState(emptyForm);
  const { funds: allFunds, loading: fundsLoading, error: fundsError } = useScopedCashData();
  const funds = useMemo(() => allFunds.filter(isActiveFund), [allFunds]);
  const { categories, error: categoriesError } = useCategories();
  const receipt = useReceiptPhotos();
  const receiptPhotos = receipt.photos;
  const [changePhoto, setChangePhoto] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [systemTime, setSystemTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setSystemTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!fundsLoading) setForm((f) => funds.some((fund) => fund.id === f.fundId) ? f : { ...f, fundId: funds[0]?.id || "" });
  }, [funds, fundsLoading]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const totalPhotoKb =
    receiptPhotos.reduce((s, p) => s + p.kb, 0) + (changePhoto ? changePhoto.kb : 0);
  const dirty = Object.keys(emptyForm).some((key) => key !== "fundId" && form[key] !== emptyForm[key]) ||
    (funds.length > 0 && form.fundId !== funds[0].id) ||
    receiptPhotos.length > 0 || Boolean(changePhoto);

  async function cancelForm() {
    if (dirty && !await confirm({
      title: "ยกเลิกการบันทึก",
      description: "ข้อมูลและรูปที่เพิ่มไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    navigate("/");
  }

  async function handleChangePhotoSelect(file) {
    if (!file) {
      setChangePhoto(null);
      return;
    }
    setCompressing(true);
    setError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setChangePhoto({ dataUrl, kb: approxKb(dataUrl) });
    } catch (err) {
      console.error(err);
      setError("อ่านไฟล์รูปไม่สำเร็จ ลองเลือกรูปใหม่อีกครั้ง");
      setChangePhoto(null);
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fundId || !funds.some((fund) => fund.id === form.fundId)) {
      setError("กรุณาเลือกฝั่งเงินหมุนเวียน");
      document.getElementById("transaction-fund-choice")?.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.transactionDate)) {
      setError("กรุณาเลือกวันที่ทำรายการ");
      document.getElementById("transaction-date")?.focus();
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("กรุณาระบุจำนวนเงินให้ถูกต้อง");
      document.getElementById("transaction-amount")?.focus();
      return;
    }
    if (!form.itemDescription.trim()) {
      setError("กรุณาระบุรายละเอียดรายการ (ซื้ออะไร / รายรับจากอะไร)");
      document.getElementById("transaction-description")?.focus();
      return;
    }
    if (!evidenceSizeValid(receiptPhotos.map((photo) => photo.dataUrl), changePhoto?.dataUrl)) {
      setError("รูปมีขนาดรวมเกินกำหนด กรุณาลดจำนวนหรือขนาดรูป");
      return;
    }

    setBusy(true);
    try {
      const fundLabel = funds.find((f) => f.id === form.fundId)?.label || "";

      const transactionRef = doc(collection(db, "transactions"));
      const fundRef = doc(db, "funds", form.fundId);
      const transactionData = {
        fundId: form.fundId,
        fundLabel,
        transactionDate: form.transactionDate,
        type: form.type,
        amount: Number(form.amount),
        withdrawnAmount: form.withdrawnAmount ? Number(form.withdrawnAmount) : null,
        itemDescription: form.itemDescription.trim(),
        changeAmount: form.changeAmount ? Number(form.changeAmount) : 0,
        paymentMethod: form.paymentMethod,
        category: form.category || "",
        note: form.note.trim(),
        receiptPhotoURL: receiptPhotos[0]?.dataUrl || null,
        receiptPhotoURLs: receiptPhotos.map((p) => p.dataUrl),
        changePhotoURL: changePhoto?.dataUrl || null,
        status: "pending",
        createdBy: user.uid,
        createdByName: profile?.name || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        reviewNote: null,
        editHistory: [],
      };
      await runTransaction(db, async (batch) => {
        const fundSnapshot = await batch.get(fundRef);
        if (!fundSnapshot.exists() || fundSnapshot.data().archived === true) {
          throw new Error("งบนี้ถูกปิดใช้งานแล้ว กรุณาเลือกงบอื่น");
        }
        batch.set(transactionRef, transactionData);
        // The fund write makes creation contend with concurrent fund archival.
        batch.update(fundRef, {
          lastCreatedTransactionId: transactionRef.id,
          transactionCreatedAt: serverTimestamp(),
        });
      });

      toast("บันทึกรายการแล้ว");
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(err.message === "งบนี้ถูกปิดใช้งานแล้ว กรุณาเลือกงบอื่น"
        ? err.message : "บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อแล้วลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <Card className="mx-auto max-w-lg p-4 sm:p-6">
        {fundsError && <p role="alert" className="mb-4 text-sm text-danger">โหลดงบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ</p>}
        {!fundsLoading && !fundsError && funds.length === 0 && (
          <p className="mb-4 rounded-lg bg-warning-light px-3 py-2 text-sm text-warning">
            {profile?.role === "owner" ? "ยังไม่มีงบค่าใช้จ่าย ให้เจ้าของร้านสร้างงบค่าใช้จ่ายก่อน" : "ยังไม่ได้รับมอบหมายงบ ติดต่อแอดมิน"}
          </p>
        )}

        <form id="new-transaction-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormHeader
            title="บันทึกรายการใหม่"
            onCancel={cancelForm}
            formId="new-transaction-form"
            saving={busy || compressing || receipt.compressing}
            savingLabel={compressing || receipt.compressing ? "กำลังจัดการรูป..." : "กำลังบันทึก..."}
            saveDisabled={fundsLoading || Boolean(fundsError) || funds.length === 0}
            hideSave={!fundsLoading && !fundsError && funds.length === 0}
            saveLabel="บันทึก"
          />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">ประเภท</legend>
            <div className="grid grid-cols-2 gap-2">
              {["income", "expense"].map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={form.type === type}
                  onClick={() => update("type", type)}
                  className={`rounded-xl border px-3 py-3 text-base font-semibold ${
                    form.type === type
                      ? type === "income"
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-red-600 bg-red-600 text-white"
                      : "border-paperLine bg-white text-inkSoft"
                  }`}
                >
                  {type === "income" ? "รายรับ" : "รายจ่าย"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2 rounded-xl border border-paperLine bg-blue-50/60 p-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label htmlFor="transaction-date" className="mb-1 block text-sm font-semibold">
                วันที่ทำรายการ
              </label>
              <Input
                id="transaction-date"
                type="date"
                required
                value={form.transactionDate}
                onChange={(event) => update("transactionDate", event.target.value)}
              />
              <p className="mt-1 text-xs text-inkSoft">
                วันที่เลือก: {form.transactionDate ? formatDate(new Date(`${form.transactionDate}T00:00:00`)) : "ยังไม่ได้เลือก"}
              </p>
            </div>
            <p className="text-sm text-inkSoft sm:pb-2">
              เวลาบันทึก (ระบบ): <time className="font-nums font-semibold text-ink">{systemTime.toLocaleTimeString("th-TH")}</time>
              <span className="mt-1 block text-xs">บันทึกเวลาจริงอัตโนมัติเมื่อกดบันทึก</span>
            </p>
          </div>

          <div>
            <label htmlFor="transaction-amount" className="mb-2 block text-sm font-semibold">
              {form.type === "expense" ? "ยอดที่จ่ายจริง (บาท)" : "จำนวนเงินรับ (บาท)"}
            </label>
            <Input
              id="transaction-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              className="h-16 text-right text-2xl font-bold font-nums"
              placeholder="0.00"
            />
          </div>

          <div>
            <label htmlFor="transaction-description" className="mb-2 block text-sm font-semibold">
              {form.type === "expense" ? "ซื้ออะไร / รายละเอียดรายจ่าย" : "รายละเอียดรายรับ"}
            </label>
            <Input
              id="transaction-description"
              required
              value={form.itemDescription}
              onChange={(e) => update("itemDescription", e.target.value)}
              placeholder="เช่น ซื้อวัตถุดิบทำอาหาร"
            />
          </div>

          <div>
            <label htmlFor="transaction-category" className="mb-2 block text-sm font-semibold">
              หมวดหมู่ (ถ้ามี)
            </label>
            <SearchPicker
              id="transaction-category"
              value={form.category}
              onChange={(value) => update("category", value)}
              options={categories.map((category) => ({ value: category.label, label: category.label }))}
              placeholder="เลือกหรือพิมพ์หมวดหมู่"
              ariaLabel="หมวดหมู่"
              clearable
              createAction={(query, { close }) => (
                <button
                  type="button"
                  onClick={() => {
                    update("category", query);
                    close();
                  }}
                  className="min-h-12 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-left text-sm font-medium text-blue-800"
                >
                  ใช้ “{query}”
                </button>
              )}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">ฝั่งเงินหมุนเวียน</label>
            <SearchPicker
              id="transaction-fund-choice"
              value={form.fundId}
              onChange={(value) => update("fundId", value)}
              options={funds.map((fund) => ({ value: fund.id, label: fund.label }))}
              placeholder="เลือกงบค่าใช้จ่าย"
              ariaLabel="งบค่าใช้จ่าย"
            />
          </div>

          <div>
            <p className="mb-2 block text-sm font-semibold">แนบหลักฐาน (ไม่บังคับ — ผู้ตรวจสอบอาจขอดูภายหลัง)</p>
            <ReceiptPhotoFields {...receipt} />
          </div>

          <details className="rounded-xl border border-paperLine bg-blue-50/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-blue-700">รายละเอียดเพิ่มเติม</summary>
            <div className="mt-4 space-y-4">
              {form.type === "expense" && (
                <>
                  <div>
                    <label htmlFor="withdrawn-amount" className="mb-1 block text-sm">เบิกเงินไปเท่าไหร่ (บาท)</label>
                    <Input
                      id="withdrawn-amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={form.withdrawnAmount}
                      onChange={(e) => update("withdrawnAmount", e.target.value)}
                      placeholder="เช่น 500"
                    />
                  </div>
                  <div>
                    <label htmlFor="change-amount" className="mb-1 block text-sm">เงินทอนที่ได้รับกลับมา (บาท)</label>
                    <Input
                      id="change-amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={form.changeAmount}
                      onChange={(e) => update("changeAmount", e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </>
              )}
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">ช่องทางการชำระเงิน</legend>
                <div className="grid grid-cols-2 gap-2">
                  {["cash", "transfer"].map((method) => (
                    <button
                      type="button"
                      key={method}
                      aria-pressed={form.paymentMethod === method}
                      onClick={() => update("paymentMethod", method)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
                        form.paymentMethod === method ? "border-blue-600 bg-blue-600 text-white" : "border-paperLine bg-white text-inkSoft"
                      }`}
                    >
                      {method === "cash" ? "เงินสด" : "โอนเงิน"}
                    </button>
                  ))}
                </div>
              </fieldset>
              {form.type === "expense" && (
                <div>
                  <label className="mb-1 block text-sm">รูปเงินทอน (ถ้ามี)</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    aria-label="เลือกรูปเงินทอน"
                    onChange={(e) => handleChangePhotoSelect(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-paperLine bg-white p-3 text-sm"
                  />
                  {changePhoto && <p className="mt-1 text-xs text-green-700">พร้อมแนบ (~{changePhoto.kb} KB)</p>}
                </div>
              )}
              <div>
                <label htmlFor="transaction-note" className="mb-1 block text-sm">หมายเหตุเพิ่มเติม</label>
                <Textarea
                  id="transaction-note"
                  value={form.note}
                  onChange={(e) => update("note", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </details>

          {totalPhotoKb > TOTAL_PHOTO_KB_WARNING && (
            <p className="text-sm text-warning" role="status">
              รูปที่แนบมีขนาดรวมค่อนข้างใหญ่ (~{totalPhotoKb} KB) หากบันทึกไม่สำเร็จ ลองลดจำนวนรูป
            </p>
          )}
          {categoriesError && <p className="text-sm text-red-600" role="alert">{categoriesError}</p>}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        </form>
      </Card>
    </Layout>
  );
}
