export function isActiveFund(fund) {
  return fund.archived !== true;
}

export function isActiveTopup(topup) {
  return topup.status !== "voided";
}
