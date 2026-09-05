import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { fileToCompressedDataUrl, approxKb } from "../lib/image";

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
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError("กรุณาระบุจำนวนเงินให้ถูกต้อง");
      return;
    }
    if (!form.itemDescription.trim()) {
      setError("กรุณาระบุรายละเอียดรายการ (ซื้ออะไร / รายรับจากอะไร)");
      return;
    }
    if (receiptPhotos.length === 0) {
      setError("กรุณาแนบรูปหลักฐาน (สลิป/ใบเสร็จ) อย่างน้อย 1 รูป เพื่อความโปร่งใส");
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
      <div className="max-w-lg mx-auto bg-white border border-paperLine rounded-lg p-6 receipt-edge">
        <h1 className="font-slab text-xl mb-1">บันทึกรายการใหม่</h1>
        <p className="text-sm text-inkSoft mb-5">รายการนี้จะรอเจ้าของร้านตรวจสอบและอนุมัติ</p>

        {funds.length === 0 && (
          <p className="text-sm text-amber bg-amber-light rounded px-3 py-2 mb-4">
            ยังไม่มีฝั่งเงินหมุนเวียนในระบบ — ให้เจ้าของร้านไปที่เมนู "กองทุน" เพื่อสร้างฝั่งก่อน
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-inkSoft block mb-1">ฝั่งเงินหมุนเวียน</label>
            <div className="flex gap-2">
              {funds.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => update("fundId", f.id)}
                  className={`flex-1 py-2 rounded border text-sm font-medium ${
                    form.fundId === f.id
                      ? "bg-ink text-white border-ink"
                      : "border-paperLine text-inkSoft"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {["expense", "income"].map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => update("type", t)}
                className={`flex-1 py-2 rounded border text-sm font-medium ${
                  form.type === t
                    ? "bg-teal text-white border-teal"
                    : "border-paperLine text-inkSoft"
                }`}
              >
                {t === "expense" ? "รายจ่าย" : "รายรับ"}
              </button>
            ))}
          </div>

          {form.type === "expense" && (
            <div>
              <label className="text-sm text-inkSoft block mb-1">เบิกเงินไปเท่าไหร่ (บาท)</label>
              <input
                type="number"
                step="0.01"
                value={form.withdrawnAmount}
                onChange={(e) => update("withdrawnAmount", e.target.value)}
                className="w-full border border-paperLine rounded px-3 py-2 font-nums focus:border-teal"
                placeholder="เช่น 500"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-inkSoft block mb-1">
              {form.type === "expense" ? "ยอดที่จ่ายจริง (บาท)" : "จำนวนเงินรับ (บาท)"}
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 font-nums focus:border-teal"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="text-sm text-inkSoft block mb-1">
              {form.type === "expense" ? "ซื้ออะไร / รายละเอียดรายจ่าย" : "รายละเอียดรายรับ"}
            </label>
            <input
              required
              value={form.itemDescription}
              onChange={(e) => update("itemDescription", e.target.value)}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
              placeholder="เช่น ซื้อวัตถุดิบทำอาหาร"
            />
          </div>

          <div>
            <label className="text-sm text-inkSoft block mb-1">หมวดหมู่ (ถ้ามี)</label>
            <input
              list="cash-category-options"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              placeholder="เลือก/พิมพ์หมวดหมู่"
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
            <datalist id="cash-category-options">
              {categories.map((c) => (
                <option key={c.id} value={c.label} />
              ))}
            </datalist>
          </div>

          {form.type === "expense" && (
            <div>
              <label className="text-sm text-inkSoft block mb-1">เงินทอนที่ได้รับกลับมา (บาท)</label>
              <input
                type="number"
                step="0.01"
                value={form.changeAmount}
                onChange={(e) => update("changeAmount", e.target.value)}
                className="w-full border border-paperLine rounded px-3 py-2 font-nums focus:border-teal"
                placeholder="0.00"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-inkSoft block mb-1">ช่องทางการชำระเงิน</label>
            <div className="flex gap-2">
              {["cash", "transfer"].map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => update("paymentMethod", m)}
                  className={`flex-1 py-2 rounded border text-sm font-medium ${
                    form.paymentMethod === m
                      ? "bg-ink text-white border-ink"
                      : "border-paperLine text-inkSoft"
                  }`}
                >
                  {m === "cash" ? "เงินสด" : "โอนเงิน"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-inkSoft block mb-1">
              รูปหลักฐาน (สลิป/ใบเสร็จ) <span className="text-rust">*จำเป็นอย่างน้อย 1 รูป</span>
            </label>

            {receiptPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {receiptPhotos.map((p, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={p.dataUrl}
                      alt={`หลักฐาน ${idx + 1}`}
                      className="rounded border border-paperLine w-full h-20 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeReceiptPhoto(idx)}
                      className="absolute top-1 right-1 bg-white/90 border border-paperLine rounded-full w-5 h-5 text-xs text-rust leading-none"
                    >
                      ×
                    </button>
                    <div className="text-[10px] text-inkSoft text-center mt-0.5">~{p.kb} KB</div>
                  </div>
                ))}
              </div>
            )}

            {receiptPhotos.length < MAX_RECEIPT_PHOTOS && (
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  addReceiptPhoto(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
                className="w-full text-sm"
              />
            )}
            <p className="text-xs text-inkSoft mt-1">
              แนบได้สูงสุด {MAX_RECEIPT_PHOTOS} รูปต่อรายการ ({receiptPhotos.length}/{MAX_RECEIPT_PHOTOS})
            </p>
          </div>

          {form.type === "expense" && (
            <div>
              <label className="text-sm text-inkSoft block mb-1">รูปเงินทอน (ถ้ามี)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleChangePhotoSelect(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              {changePhoto && (
                <p className="text-xs text-teal mt-1">พร้อมแนบ (บีบอัดแล้วเหลือ ~{changePhoto.kb} KB)</p>
              )}
            </div>
          )}

          {totalPhotoKb > TOTAL_PHOTO_KB_WARNING && (
            <p className="text-xs text-amber">
              * รูปที่แนบรวมกันมีขนาดค่อนข้างใหญ่ (~{totalPhotoKb} KB) ถ้าบันทึกไม่สำเร็จ ลองลดจำนวนรูปดู
            </p>
          )}

          <div>
            <label className="text-sm text-inkSoft block mb-1">หมายเหตุเพิ่มเติม</label>
            <textarea
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              rows={2}
              className="w-full border border-paperLine rounded px-3 py-2 focus:border-teal"
            />
          </div>

          {error && <p className="text-sm text-rust">{error}</p>}

          <button
            type="submit"
            disabled={busy || compressing}
            className="w-full bg-teal text-white rounded py-2.5 font-medium hover:bg-teal-dark disabled:opacity-60"
          >
            {compressing ? "กำลังบีบอัดรูป..." : busy ? "กำลังบันทึก..." : "บันทึกรายการ"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
