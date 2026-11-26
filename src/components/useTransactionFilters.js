import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function rowDate(row) {
  const value = row.createdAt || row.reviewedAt || row.date;
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function currentDate() {
  return new Date();
}

function withinDate(date, filters, today) {
  if (!date || Number.isNaN(date.getTime())) return false;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (filters.datePreset === "today") return start.getTime() === todayStart.getTime();
  if (filters.datePreset === "week") {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    return start >= weekStart && start <= todayStart;
  }
  if (filters.datePreset === "month") {
    return start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();
  }
  if (filters.datePreset === "custom") {
    if (filters.fromDate && start < new Date(`${filters.fromDate}T00:00:00`)) return false;
    if (filters.toDate && start > new Date(`${filters.toDate}T23:59:59.999`)) return false;
  }
  return true;
}

export default function useTransactionFilters(rows, {
  getDate = rowDate,
  initialStatus = "all",
  initialDatePreset = "all",
  initialFromDate = "",
  initialToDate = "",
  getToday = currentDate,
} = {}) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const storageKey = `cash-filters:${user?.uid}:${profile?.role}:${location.pathname}`;
  const defaults = {
    search: "",
    datePreset: initialDatePreset,
    fromDate: initialFromDate,
    toDate: initialToDate,
    fund: "all",
    category: "all",
    status: initialStatus,
    author: "all",
  };
  const [filters, setFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return defaults;
      const { __visibleCount, ...savedFilters } = JSON.parse(saved);
      return { ...defaults, ...savedFilters };
    } catch (error) {
      console.error("ไม่สามารถเรียกคืนตัวกรอง:", error);
      return defaults;
    }
  });
  const [visibleCount, setVisibleCount] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      return Number.isInteger(saved?.__visibleCount) && saved.__visibleCount >= 10 ? saved.__visibleCount : 10;
    } catch (error) {
      console.error("ไม่สามารถเรียกคืนจำนวนรายการ:", error);
      return 10;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ ...filters, __visibleCount: visibleCount }));
    } catch (error) {
      console.error("ไม่สามารถเก็บตัวกรอง:", error);
    }
  }, [storageKey, filters, visibleCount]);

  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [rows]
  );
  const authors = useMemo(
    () => [...new Set(rows.map((row) => row.createdByName || row.by).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")),
    [rows]
  );

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("th");
    return rows.filter((row) => {
      if (!withinDate(getDate(row), filters, getToday())) return false;
      if (filters.fund !== "all" && row.fundId !== filters.fund) return false;
      if (filters.category !== "all" && row.category !== filters.category) return false;
      if (filters.status !== "all" && (row.status || "approved") !== filters.status) return false;
      if (filters.author !== "all" && (row.createdByName || row.by) !== filters.author) return false;
      if (search) {
        const searchable = `${row.itemDescription || row.detail || ""} ${row.note || ""} ${row.category || ""} ${row.createdByName || row.by || ""}`.toLocaleLowerCase("th");
        if (!searchable.includes(search)) return false;
      }
      return true;
    });
  }, [rows, filters, getDate, getToday]);

  const totals = useMemo(() => filtered.reduce(
    (result, row) => {
      const amount = Math.abs(Number(row.amount) || 0);
      const type = row.type || row.kind;
      if (type === "income" || type === "topup") result.income += amount;
      if (type === "expense") result.expense += amount;
      return result;
    },
    { income: 0, expense: 0 }
  ), [filtered]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({
      search: "",
      datePreset: initialDatePreset,
      fromDate: initialFromDate,
      toDate: initialToDate,
      fund: "all",
      category: "all",
      status: initialStatus,
      author: "all",
    });
  }

  return { filters, updateFilter, clearFilters, filtered, categories, authors, totals, visibleCount, setVisibleCount };
}
