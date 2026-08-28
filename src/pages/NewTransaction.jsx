import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import { fileToCompressedDataUrl, approxKb } from "../lib/image";

const emptyForm = {
  fundId: "",
  type: "expense",
  amount: "",
  withdrawnAmount: "",
  itemDescription: "",
  changeAmount: "",
  paymentMethod: "cash",
  note: "",
};

export default function NewTransaction() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [funds, setFunds] = useState([]);
  const [receiptPhoto, setReceiptPhoto] = useState(null); // { dataUrl, kb }
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
    return () => unsub();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handlePhotoSelect(file, setter) {
    if (!file) {
      setter(null);
      return;
    }
    setCompressing(true);
    setError("");
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setter({ dataUrl, kb: approxKb(dataUrl) });
    } catch (err) {
      console.error(err);
      setError("อ่านไฟล์รูปไม่สำเร็จ ลองเลือกรูปใหม่อีกครั้ง");
      setter(null);
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
    if (!receiptPhoto) {
      setError("กรุณาแนบรูปหลักฐาน (สลิป/ใบเสร็จ) เพื่อความโปร่งใส");
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
        note: form.note.trim(),
        receiptPhotoURL: receiptPhoto.dataUrl,
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
              รูปหลักฐาน (สลิป/ใบเสร็จ) <span className="text-rust">*จำเป็น</span>
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              required
              onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null, setReceiptPhoto)}
              className="w-full text-sm"
            />
            {receiptPhoto && (
              <p className="text-xs text-teal mt-1">พร้อมแนบ (บีบอัดแล้วเหลือ ~{receiptPhoto.kb} KB)</p>
            )}
          </div>

          {form.type === "expense" && (
            <div>
              <label className="text-sm text-inkSoft block mb-1">รูปเงินทอน (ถ้ามี)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0] || null, setChangePhoto)}
                className="w-full text-sm"
              />
              {changePhoto && (
                <p className="text-xs text-teal mt-1">พร้อมแนบ (บีบอัดแล้วเหลือ ~{changePhoto.kb} KB)</p>
              )}
            </div>
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
