import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
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

const MAX_RECEIPT_PHOTOS = 3;
const TOTAL_PHOTO_KB_WARNING = 700;

const emptyForm = {
  fundId: "",
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
  const [funds, setFunds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [receiptPhotos, setReceiptPhotos] = useState([]); // [{ dataUrl, kb }]
  const [changePhoto, setChangePhoto] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "funds"), orderBy("createdAt", "asc")), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFunds(list);
      setForm((f) => (f.fundId ? f : { ...f, fundId: list[0]?.id || "" }));
    });
    const unsub2 = onSnapshot(collection(db, "cashCategories"), (snap) => {
      setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub();
      unsub2();
    };
  }, []);

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

  async function addReceiptPhoto(file) {
    if (!file) return;
    if (receiptPhotos.length >= MAX_RECEIPT_PHOTOS) {
      setError(`แนบรูปหลักฐานได้สูงสุด ${MAX_RECEIPT_PHOTOS} รูปต่อรายการ`);
      return;
    }
    setCompressing(true);
    setError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setReceiptPhotos((ps) => [...ps, { dataUrl, kb: approxKb(dataUrl) }]);
    } catch (err) {
      console.error(err);
      setError("อ่านไฟล์รูปไม่สำเร็จ ลองเลือกรูปใหม่อีกครั้ง");
    } finally {
      setCompressing(false);
    }
  }

  function removeReceiptPhoto(idx) {
    setReceiptPhotos((ps) => ps.filter((_, i) => i !== idx));
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

    if (!form.fundId) {
      setError("กรุณาเลือกฝั่งเงินหมุนเวียน");
      document.getElementById("transaction-fund-choice")?.focus();
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
    if (receiptPhotos.length === 0) {
      setError("กรุณาแนบรูปหลักฐาน (สลิป/ใบเสร็จ) อย่างน้อย 1 รูป เพื่อความโปร่งใส");
      document.querySelector('input[aria-label="ถ่ายหรือเลือกรูปหลักฐาน"]')?.focus();
      return;
    }

    setBusy(true);
    try {
      const fundLabel = funds.find((f) => f.id === form.fundId)?.label || "";

      await addDoc(collection(db, "transactions"), {
        fundId: form.fundId,
        fundLabel,
        type: form.type,
        amount: Number(form.amount),
        withdrawnAmount: form.withdrawnAmount ? Number(form.withdrawnAmount) : null,
        itemDescription: form.itemDescription.trim(),
        changeAmount: form.changeAmount ? Number(form.changeAmount) : 0,
        paymentMethod: form.paymentMethod,
        category: form.category || "",
        note: form.note.trim(),
        receiptPhotoURL: receiptPhotos[0].dataUrl, // เก็บรูปแรกไว้ในฟิลด์เดิมด้วย เพื่อให้ของเก่ายังใช้ได้
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
      });

      toast("บันทึกรายการแล้ว");
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout>
      <Card className="mx-auto max-w-lg p-4 sm:p-6">
        {funds.length === 0 && (
          <p className="mb-4 rounded-lg bg-amber-light px-3 py-2 text-sm text-amber">
            ยังไม่มีงบค่าใช้จ่าย ให้เจ้าของร้านสร้างงบค่าใช้จ่ายก่อน
          </p>
        )}

        <form id="new-transaction-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          <FormHeader
            title="บันทึกรายการใหม่"
            onCancel={cancelForm}
            formId="new-transaction-form"
            saving={busy || compressing}
            savingLabel={compressing ? "กำลังจัดการรูป..." : "กำลังบันทึก..."}
            saveDisabled={funds.length === 0}
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
            <label className="mb-2 block text-sm font-semibold">
              รูปหลักฐาน <span className="text-red-600">จำเป็นอย่างน้อย 1 รูป</span>
            </label>
            {receiptPhotos.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {receiptPhotos.map((photo, index) => (
                  <div key={index} className="relative min-w-0">
                    <img src={photo.dataUrl} alt={`หลักฐาน ${index + 1}`} className="h-24 w-full rounded-lg border border-paperLine object-cover" />
                    <button
                      type="button"
                      aria-label={`ลบรูปหลักฐาน ${index + 1}`}
                      onClick={() => removeReceiptPhoto(index)}
                      className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-paperLine bg-white text-red-600"
                    >
                      ×
                    </button>
                    <div className="mt-1 text-center text-xs text-inkSoft">~{photo.kb} KB</div>
                  </div>
                ))}
              </div>
            )}
            {receiptPhotos.length < MAX_RECEIPT_PHOTOS && (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="ถ่ายหรือเลือกรูปหลักฐาน"
                onChange={(e) => {
                  addReceiptPhoto(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
                className="w-full rounded-lg border border-paperLine bg-blue-50 p-3 text-sm"
              />
            )}
            <p className="mt-1 text-xs text-inkSoft">
              แนบได้สูงสุด {MAX_RECEIPT_PHOTOS} รูป ({receiptPhotos.length}/{MAX_RECEIPT_PHOTOS})
            </p>
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
            <p className="text-sm text-amber" role="status">
              รูปที่แนบมีขนาดรวมค่อนข้างใหญ่ (~{totalPhotoKb} KB) หากบันทึกไม่สำเร็จ ลองลดจำนวนรูป
            </p>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        </form>
      </Card>
    </Layout>
  );
}
