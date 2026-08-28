export function lineTotal(lines) {
  return (lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

/** ยอดที่โอนจ่ายไปแล้วทั้งหมด ที่ตัดยอดกับใบเบิกฉบับนี้ (รวมทุกใบโอนจ่ายที่เลือกใบเบิกนี้) */
export function transferredAgainst(withdrawalRequestId, allTransferPayments) {
  return allTransferPayments
    .filter((p) => p.linkedWithdrawalRequestId === withdrawalRequestId)
    .reduce((sum, p) => sum + lineTotal(p.lines), 0);
}

/** ยอดคงเหลือของใบเบิก = ยอดเบิกทั้งหมด - ยอดที่โอนจ่ายตัดไปแล้ว */
export function remainingBalance(withdrawalRequest, allTransferPayments) {
  const total = withdrawalRequest.totalAmount ?? lineTotal(withdrawalRequest.lines);
  return total - transferredAgainst(withdrawalRequest.id, allTransferPayments);
}

export function nextLineNo(lines) {
  return (lines || []).length + 1;
}

export function renumberLines(lines) {
  return lines.map((l, i) => ({ ...l, lineNo: i + 1 }));
}
