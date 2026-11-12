import { useEffect, useState } from "react";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import PageHeader from "../components/ui/PageHeader";
import { useFeedback } from "../components/ui/FeedbackProvider";
import SegmentedTabs from "../components/ui/SegmentedTabs";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import BankAccountCreateSheet from "../components/BankAccountCreateSheet";

function AccountList({ title, hint, side, accounts }) {
  const { confirm, toast } = useFeedback();
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");

  async function remove(account) {
    if (!await confirm({
      title: "ลบบัญชีธนาคาร",
      description: "ลบบัญชีนี้ออกจากรายการโปรด?",
      confirmLabel: "ลบบัญชี",
      danger: true,
    })) return;
    try {
      await deleteDoc(doc(db, "bankAccounts", account.id));
      toast("ลบบัญชีธนาคารแล้ว");
    } catch (deleteError) {
      console.error(deleteError);
      setError("ลบบัญชีธนาคารไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  const list = accounts.filter((account) => account.side === side);

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-inkSoft">{hint}</p>
      {error && <p role="alert" className="mb-3 text-sm text-rust">{error}</p>}

      <div className="mb-4 space-y-2">
        {list.length === 0 && <p className="text-sm text-inkSoft">ยังไม่มีบัญชีที่บันทึกไว้</p>}
        {list.map((account) => (
          <div key={account.id} className="flex items-center justify-between gap-2 rounded-lg border border-paperLine p-3">
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-medium">{account.bankName} · {account.accountNumber}</div>
              <div className="text-xs text-inkSoft">
                {account.accountName}{account.note ? ` · ${account.note}` : ""}
              </div>
            </div>
            <Button
              variant="danger"
              type="button"
              onClick={() => remove(account)}
              aria-label={`ลบบัญชี ${account.bankName} ${account.accountNumber}`}
              className="shrink-0 px-3"
            >
              ลบ
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        type="button"
        onClick={() => setFormOpen(true)}
        className="px-3 text-blue-700"
      >
        + เพิ่มบัญชี
      </Button>
      <BankAccountCreateSheet
        open={formOpen}
        side={side}
        onClose={() => {
          setFormOpen(false);
          setError("");
        }}
        onCreated={() => setFormOpen(false)}
      />
    </Card>
  );
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [section, setSection] = useState("source");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "bankAccounts"),
      (snapshot) => setAccounts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))
    );
    return () => unsubscribe();
  }, []);

  return (
    <Layout>
      <PageHeader title="บัญชีธนาคาร" fallbackTo="/settings" />
      <SegmentedTabs
        value={section}
        onChange={setSection}
        ariaLabel="ประเภทบัญชีธนาคาร"
        variant="segment"
        className="mb-4 grid grid-cols-2"
        options={[
          { value: "source", label: "บัญชีต้นทาง" },
          { value: "payee", label: "บัญชีผู้รับ" },
        ]}
      />
      {section === "source" ? (
        <AccountList
          title="บัญชีต้นทาง"
          hint="บัญชีที่ใช้รับเงินตอนเบิก และเป็นบัญชีต้นทางตอนโอนจ่ายออก"
          side="source"
          accounts={accounts}
        />
      ) : (
        <AccountList
          title="บัญชีผู้รับ"
          hint="บัญชีของผู้รับเงินปลายทาง เช่น ซัพพลายเออร์หรือพนักงาน"
          side="payee"
          accounts={accounts}
        />
      )}
    </Layout>
  );
}
