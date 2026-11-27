import { isActiveTopup } from "./cashStatus.js";
import { parseSatang } from "./money.js";

export function matchingRecentTopups({ fundId, amount }, topups, now = Date.now()) {
  let satang;
  try {
    satang = parseSatang(amount);
  } catch {
    return [];
  }
  return topups.filter((entry) => {
    if (!isActiveTopup(entry) || entry.fundId !== fundId || !entry.createdAt) return false;
    const time = entry.createdAt.toDate ? entry.createdAt.toDate().getTime() : new Date(entry.createdAt).getTime();
    if (!Number.isFinite(time) || Math.abs(now - time) > 10 * 60 * 1000) return false;
    try {
      return parseSatang(entry.amount) === satang;
    } catch {
      return false;
    }
  });
}
