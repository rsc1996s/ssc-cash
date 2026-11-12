export function withdrawalReportRows(lines = [], groupByCategory = false) {
  const normalRows = lines.map((line, index) => ({
    type: "line",
    line,
    index,
  }));
  if (!groupByCategory) return normalRows;

  const groups = new Map();
  normalRows.forEach((row) => {
    const category = row.line.categoryLabel || "ไม่ระบุหมวด";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(row);
  });

  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, "th"))
    .flatMap(([category, rows]) => [
      { type: "category", category },
      ...rows,
      {
        type: "subtotal",
        category,
        amount: rows.reduce((sum, row) => sum + (Number(row.line.amount) || 0), 0),
      },
    ]);
}
