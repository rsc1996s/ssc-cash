import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useFeedback } from "./ui/FeedbackProvider";
import FormHeader from "./ui/FormHeader";
import Input from "./ui/Input";
import SearchPicker from "./ui/SearchPicker";
import Sheet from "./ui/Sheet";
import { THAI_BANKS } from "../config/banks";
import { normalizeSearchText } from "./ui/searchText";

const EMPTY_ACCOUNT = { bankName: "", accountNumber: "", accountName: "", note: "" };

function accountNumberKey(value) {
  return String(value || "").replace(/\D/g, "");
}

function isAccountNumberQuery(value) {
  return /^[\d -]+$/.test(value) && /\d/.test(value);
}

export default function BankAccountCreateSheet({
  open,
  side,
  initialSearch = "",
  onClose,
  onCreated,
}) {
  const { user, isOwner } = useAuth();
  const { confirm, toast } = useFeedback();
  const [accounts, setAccounts] = useState([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [otherBank, setOtherBank] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);

  useEffect(() => {
    if (!open || !isOwner) return undefined;
    setAccountsLoaded(false);
    const unsubscribe = onSnapshot(
      collection(db, "bankAccounts"),
      (snapshot) => {
        setAccounts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setAccountsLoaded(true);
      },
      (loadError) => {
        console.error("โหลดบัญชีธนาคารไม่สำเร็จ:", loadError);
        setError("โหลดบัญชีธนาคารไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และการเชื่อมต่อ");
        setAccountsLoaded(false);
      }
    );
    return () => unsubscribe();
  }, [open, isOwner]);

  useEffect(() => {
    if (!open) return;
    const query = initialSearch.trim();
    setForm({
      ...EMPTY_ACCOUNT,
      accountNumber: isAccountNumberQuery(query) ? query : "",
      accountName: query && !isAccountNumberQuery(query) ? query : "",
    });
    setOtherBank(false);
    setDuplicate(null);
    setError("");
  }, [open, initialSearch]);

  const bankOptions = [
    ...THAI_BANKS,
    { value: "__other__", label: "อื่น ๆ" },
  ];

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDuplicate(null);
    setError("");
  }

  function findDuplicate() {
    const bank = normalizeSearchText(form.bankName);
    const number = accountNumberKey(form.accountNumber);
    return accounts.find((account) =>
      normalizeSearchText(account.bankName) === bank &&
      accountNumberKey(account.accountNumber) === number
    );
  }

  async function addAccount(event) {
    event.preventDefault();
    if (!isOwner) {
      setError("เฉพาะเจ้าของร้านเท่านั้นที่เพิ่มบัญชีในคลังได้");
      return;
    }
    const bankName = (otherBank ? form.bankName : form.bankName).trim();
    const accountNumber = form.accountNumber.trim();
    const accountName = form.accountName.trim();
    if (!bankName || !accountNumber || !accountName) {
      setError("กรุณากรอกธนาคาร เลขที่บัญชี และชื่อบัญชี");
      document.getElementById(!bankName ? "quick-bank-name" : !accountNumber ? "quick-bank-number" : "quick-account-name")?.focus();
      return;
    }
    if (!/^[0-9-]+$/.test(accountNumber) || !/\d/.test(accountNumber)) {
      setError("เลขที่บัญชีต้องมีเฉพาะตัวเลขและขีด");
      document.getElementById("quick-bank-number")?.focus();
      return;
    }
    const match = findDuplicate();
    if (match) {
      setDuplicate(match);
      setError(match.side === side
        ? "มีบัญชีธนาคารและเลขที่บัญชีนี้อยู่แล้ว เลือกบัญชีเดิมได้"
        : "เลขบัญชีนี้อยู่ในคลังอีกประเภทแล้ว จึงเพิ่มซ้ำไม่ได้");
      return;
    }

    if (!await confirm({
      title: "ตรวจสอบบัญชีก่อนเพิ่ม",
      description: `${bankName} · ${accountNumber} · ${accountName}${form.note.trim() ? ` · ${form.note.trim()}` : ""}\n\nเมื่อเพิ่มแล้วจะแก้ไขบัญชีนี้ไม่ได้`,
      confirmLabel: "ยืนยันและเพิ่มบัญชี",
      cancelLabel: "กลับไปแก้",
    })) return;

    setBusy(true);
    setError("");
    try {
      const created = await addDoc(collection(db, "bankAccounts"), {
        side,
        bankName,
        accountNumber,
        accountName,
        note: form.note.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      const account = { id: created.id, side, bankName, accountNumber, accountName, note: form.note.trim() };
      toast("เพิ่มบัญชีธนาคารแล้ว");
      onCreated?.(account);
      onClose();
    } catch (addError) {
      console.error("เพิ่มบัญชีธนาคารไม่สำเร็จ:", addError);
      setError("เพิ่มบัญชีธนาคารไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  function useDuplicate() {
    if (!duplicate || duplicate.side !== side) return;
    onCreated?.(duplicate);
    onClose();
  }

  async function cancelCreate() {
    const changed = Object.entries(form).some(([field, value]) => value.trim() !== EMPTY_ACCOUNT[field]) ||
      otherBank;
    if (changed && !await confirm({
      title: "ยกเลิกการเพิ่มบัญชี",
      description: "ข้อมูลที่กรอกไว้แต่ยังไม่ได้บันทึกจะหายไป",
      confirmLabel: "ทิ้งข้อมูล",
      cancelLabel: "ทำต่อ",
      danger: true,
    })) return;
    onClose();
  }

  return (
    <Sheet
      open={open}
      title="เพิ่มบัญชีธนาคาร"
      onClose={cancelCreate}
      header={
        <FormHeader
          title="เพิ่มบัญชีธนาคาร"
          onCancel={cancelCreate}
          formId="quick-bank-account-form"
          saving={busy}
          saveDisabled={!isOwner || !accountsLoaded}
        />
      }
    >
      {!isOwner ? (
        <p role="alert" className="text-sm text-rust">เฉพาะเจ้าของร้านเท่านั้นที่เพิ่มบัญชีในคลังได้</p>
      ) : (
        <form id="quick-bank-account-form" onSubmit={addAccount} noValidate className="space-y-3">
          <label className="block text-sm font-medium">
            ธนาคาร
            <SearchPicker
              value={otherBank ? "__other__" : form.bankName}
              onChange={(value) => {
                if (value === "__other__") {
                  setOtherBank(true);
                  update("bankName", "");
                } else {
                  setOtherBank(false);
                  update("bankName", value);
                }
              }}
              options={bankOptions}
              placeholder="เลือกธนาคาร"
              ariaLabel="ธนาคาร"
              className="mt-1"
            />
          </label>
          {otherBank && (
            <Input
              id="quick-bank-name"
              value={form.bankName}
              onChange={(event) => update("bankName", event.target.value)}
              placeholder="ชื่อธนาคารอื่น"
              aria-label="ชื่อธนาคารอื่น"
            />
          )}
          <Input
            id="quick-bank-number"
            value={form.accountNumber}
            onChange={(event) => update("accountNumber", event.target.value)}
            placeholder="เลขที่บัญชี"
            aria-label="เลขที่บัญชี"
            inputMode="numeric"
          />
          <Input
            id="quick-account-name"
            value={form.accountName}
            onChange={(event) => update("accountName", event.target.value)}
            placeholder="ชื่อบัญชี"
            aria-label="ชื่อบัญชี"
          />
          <Input
            value={form.note}
            onChange={(event) => update("note", event.target.value)}
            placeholder="หมายเหตุ (ถ้ามี)"
            aria-label="หมายเหตุ"
          />
          <p className="rounded-lg bg-amber-light p-3 text-sm text-amber">
            ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก บัญชีที่เพิ่มแล้วแก้ไขไม่ได้
          </p>
          {!accountsLoaded && <p role="status" className="text-sm text-inkSoft">กำลังตรวจสอบบัญชีซ้ำ...</p>}
          {error && <p role="alert" className="text-sm text-rust">{error}</p>}
          {duplicate?.side === side && (
            <button type="button" onClick={useDuplicate} className="min-h-12 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-800">
              ใช้บัญชีเดิม: {duplicate.bankName} · {duplicate.accountNumber} ({duplicate.accountName})
            </button>
          )}
        </form>
      )}
    </Sheet>
  );
}
