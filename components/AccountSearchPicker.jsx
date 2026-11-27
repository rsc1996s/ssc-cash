import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import BankAccountCreateSheet from "./BankAccountCreateSheet";
import SearchPicker from "./ui/SearchPicker";
import { normalizeSearchText } from "./ui/searchText";

export default function AccountSearchPicker({
  accounts,
  side,
  value,
  onChange,
  ariaLabel,
  placeholder = "เลือกบัญชี",
  disabled = false,
  id,
}) {
  const { isOwner } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [recentAccount, setRecentAccount] = useState(null);
  const options = [...accounts, ...(recentAccount ? [recentAccount] : [])]
    .filter((account) => account.side === side)
    .filter((account, index, list) => list.findIndex((item) => item.id === account.id) === index)
    .map((account) => ({
      value: account.id,
      label: `${account.bankName} · ${account.accountNumber}`,
      sublabel: account.accountName,
      searchText: `${account.bankName} ${account.accountNumber} ${account.accountName} ${account.note || ""}`,
      exactSearchValues: [
        account.bankName,
        account.accountName,
        account.accountNumber,
        account.accountNumber.replace(/\D/g, ""),
      ],
    }));

  return (
    <>
      <SearchPicker
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        disabled={disabled}
        helperText={isOwner ? "พิมพ์ชื่อใหม่เพื่อเพิ่มเข้าคลัง" : undefined}
        noResultsText="ไม่พบบัญชีนี้ กรุณาติดต่อเจ้าของร้านให้เพิ่มเข้าคลัง"
        isExactMatch={(query, items) => {
          const normalized = normalizeSearchText(query);
          const digits = query.replace(/\D/g, "");
          return items.some((option) =>
            option.exactSearchValues.some((value) =>
              normalizeSearchText(value) === normalized ||
              (digits && /^[\d -]+$/.test(query) && value === digits)
            )
          );
        }}
        createAction={isOwner ? (query) => (
          <button
            type="button"
            onClick={() => {
              setSearch(query);
              setCreateOpen(true);
            }}
            className="min-h-12 w-full rounded-lg border border-blue-200 bg-blue-50 px-3 text-left text-sm font-medium text-blue-800"
          >
            + เพิ่มบัญชีใหม่ “{query}”
          </button>
        ) : undefined}
      />
      <BankAccountCreateSheet
        open={createOpen}
        side={side}
        initialSearch={search}
        onClose={() => setCreateOpen(false)}
        onCreated={(account) => {
          setRecentAccount(account);
          onChange(account.id);
        }}
      />
    </>
  );
}
