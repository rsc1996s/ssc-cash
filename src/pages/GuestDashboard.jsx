import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import { formatBaht, formatDateTime, TYPE_LABEL } from "../lib/format";
import { currentFundBalance } from "../lib/ledger";

export default function GuestDashboard() {
  const [rows, setRows] = useState([]);
  const [topups, setTopups] = useState([]);
  const [funds, setFunds] = useState([]);
  const [staffFilter, setStaffFilter] = useState("all");
  const [fundFilter, setFundFilter] = useState("all");

  useEffect(() => {
    // guest อ่านได้เฉพาะรายการที่ "อนุมัติแล้ว" เท่านั้น (บังคับที่ Firestore rules ด้วย)
    const q = query(collection(db, "transactions"), where("status", "==", "approved"));
    const unsub1 = onSnapshot(q, (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsub2 = onSnapshot(collection(db, "funds"), (snap) =>
      setFunds(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(collection(db, "fundTopups"), (snap) =>
      setTopups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  const staffNames = Array.from(new Set(rows.map((r) => r.createdByName))).sort();

  const filtered = rows
    .filter((r) => (staffFilter === "all" ? true : r.createdByName === staffFilter))
    .filter((r) => (fundFilter === "all" ? true : r.fundId === fundFilter))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  return (
    <Layout>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {funds.map((f) => (
          <div key={f.id} className="bg-white border border-paperLine rounded-lg p-4 receipt-edge">
            <div className="text-xs text-inkSoft mb-1">{f.label}</div>
            <div className="font-nums text-xl">{formatBaht(currentFundBalance(f, topups, rows))} บาท</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="font-slab text-lg">รายการที่อนุมัติแล้ว (ดูอย่างเดียว)</h1>
        <Link to="/reports" className="text-sm border border-paperLine rounded px-3 py-1.5">
          ดูรายงาน Statement
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="text-xs border border-paperLine rounded-full px-3 py-1.5"
        >
          <option value="all">พนักงานทุกคน</option>
          {staffNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={fundFilter}
          onChange={(e) => setFundFilter(e.target.value)}
          className="text-xs border border-paperLine rounded-full px-3 py-1.5"
        >
          <option value="all">ทุกฝั่ง</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-inkSoft">ยังไม่มีรายการที่อนุมัติแล้ว</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-paperLine rounded-lg p-4 receipt-edge hover:border-teal flex items-center gap-3"
            >
              <Link to={`/transaction/${r.id}`} className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-inkSoft mb-1">
                      {r.fundLabel} · {TYPE_LABEL[r.type]} · โดย {r.createdByName}
                    </div>
                    <div className="font-medium">{r.itemDescription}</div>
                    <div className="text-xs text-inkSoft mt-1">{formatDateTime(r.createdAt)}</div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-nums text-lg ${
                        r.type === "income" ? "text-teal" : "text-rust"
                      }`}
                    >
                      {r.type === "income" ? "+" : "-"}
                      {formatBaht(r.amount)}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </div>
              </Link>
              <Link
                to={`/transaction/${r.id}/print`}
                target="_blank"
                className="shrink-0 text-xs border border-paperLine rounded px-3 py-2 hover:border-teal hover:text-teal"
              >
                พิมพ์
              </Link>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
