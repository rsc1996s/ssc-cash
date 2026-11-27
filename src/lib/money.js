export function parseSatang(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("กรุณากรอกจำนวนเงินไม่เกิน 2 ตำแหน่งทศนิยม");
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result <= 0 || result > 100000000000) {
    throw new Error("จำนวนเงินต้องมากกว่า 0 และไม่เกิน 1,000,000,000 บาท");
  }
  return result;
}

export function sumSatang(amounts) {
  return amounts.reduce((sum, amount) => {
    const result = sum + parseSatang(amount);
    if (!Number.isSafeInteger(result)) throw new Error("ยอดรวมเกินขอบเขตที่รองรับ");
    return result;
  }, 0);
}
