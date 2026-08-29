import { useEffect, useMemo, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Layout from "../components/Layout";
import { formatBaht, formatDateTime, TYPE_LABEL } from "../lib/format";
import { buildFundLedger, statementForRange } from "../lib/ledger";

function toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: "today", label: "วันนี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "year", label: "ปีนี้" },
];

export default function Reports() {
  const [funds, setFunds] = useState([]);
  const [topups, setTopups] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [fundId, setFundId] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "funds"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFunds(list);
      setFundId((cur) => cur || list[0]?.id || "");
    });
    const unsub2 = onSnapshot(collection(db, "fundTopups"), (snap) =>
      setTopups(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsub3 = onSnapshot(query(collection(db, "transactions"), where("status", "==", "approved")), (snap) =>
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  function applyPreset(key) {
    const now = new Date();
    if (key === "today") {
      setFrom(toInputDate(now));
      setTo(toInputDate(now));
    } else if (key === "month") {
      setFrom(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(toInputDate(now));
    } else if (key === "year") {
      setFrom(toInputDate(new Date(now.getFullYear(), 0, 1)));
      setTo(toInputDate(now));
    }
  }

  const fund = funds.find((f) => f.id === fundId);

  const statement = useMemo(() => {
    if (!fund) return null;
    const ledger = buildFundLedger(fund, topups, transactions);
    const start = new Date(from + "T00:00:00");
    const end = new Date(to + "T23:59:59");
    return statementForRange(ledger, start, end, fund.openingBalance || 0);
  }, [fund, topups, transactions, from, to]);

  return (
    <Layout>
      <div className="no-print flex items-center justify-between mb-4">
        <h1 className="font-slab text-lg">รายงาน Statement</h1>
        {statement && (
          <button
            onClick={() => window.print()}
            className="bg-teal text-white rounded px-4 py-2 text-sm font-medium"
          >
            พิมพ์รายงาน
          </button>
        )}
      </div>

      <div className="no-print bg-white border border-paperLine rounded-lg p-4 mb-5 receipt-edge">
        <label className="text-xs text-inkSoft block mb-1">เลือกฝั่งเงินหมุนเวียน</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {funds.map((f) => (
            <button
              key={f.id}
              onClick={() => setFundId(f.id)}
              className={`text-xs rounded-full px-3 py-1.5 border ${
                fundId === f.id ? "bg-ink text-white border-ink" : "border-paperLine text-inkSoft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-inkSoft block mb-1">จากวันที่</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-paperLine rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-inkSoft block mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-paperLine rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="text-xs border border-paperLine rounded px-2 py-1.5"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!fund ? (
        <p className="text-sm text-inkSoft">
          ยังไม่มีฝั่งเงินหมุนเวียนในระบบ — ไปที่เมนู "กองทุน" เพื่อสร้างฝั่งก่อน
        </p>
      ) : (
        <div className="print-sheet bg-white border border-paperLine rounded-lg p-6 receipt-edge">
          <div className="text-center mb-4">
            <h2 className="font-slab text-lg">รายงานเงินหมุนเวียน: {fund.label}</h2>
            <p className="text-sm text-inkSoft">
              ช่วงวันที่ {from} ถึง {to}
            </p>
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-paperLine text-inkSoft text-xs">
                <th className="text-left py-2">วันที่</th>
                <th className="text-left py-2">รายการ</th>
                <th className="text-left py-2">ประเภท</th>
                <th className="text-right py-2">จำนวนเงิน</th>
                <th className="text-right py-2">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {statement.entries.map((e, i) => (
                <tr key={i} className="border-b border-paperLine/60">
                  <td className="py-2">{formatDateTime(e.date)}</td>
                  <td className="py-2">{e.detail}</td>
                  <td className="py-2">
                    {e.kind === "topup" ? "เงินเข้ากองทุน" : TYPE_LABEL[e.kind] || e.kind}
                  </td>
                  <td
                    className={`py-2 text-right font-nums ${
                      e.amount < 0 ? "text-rust" : "text-teal"
                    }`}
                  >
                    {e.amount < 0 ? "-" : "+"}
                    {formatBaht(Math.abs(e.amount))}
                  </td>
                  <td className="py-2 text-right font-nums">{formatBaht(e.balance)}</td>
                </tr>
              ))}
              {statement.entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-inkSoft">
                    ไม่มีรายการในช่วงที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <dl className="grid grid-cols-2 gap-y-1 text-sm max-w-xs ml-auto font-nums">
            <dt className="text-inkSoft">ยอดยกมา</dt>
            <dd className="text-right">{formatBaht(statement.openingBalance)}</dd>
            <dt className="text-inkSoft">เงินเข้ารวม (ช่วงนี้)</dt>
            <dd className="text-right text-teal">+{formatBaht(statement.totalIn)}</dd>
            <dt className="text-inkSoft">เงินออกรวม (ช่วงนี้)</dt>
            <dd className="text-right text-rust">-{formatBaht(statement.totalOut)}</dd>
            <dt className="font-medium border-t border-ink pt-1">ยอดคงเหลือ</dt>
            <dd className="text-right font-medium border-t border-ink pt-1">
              {formatBaht(statement.closingBalance)}
            </dd>
          </dl>
        </div>
      )}
    </Layout>
  );
}
