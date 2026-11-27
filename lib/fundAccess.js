export function canViewFund(profile, fundId) {
  if (!profile || profile.disabled === true) return false;
  if (profile.role === "owner") return true;
  if (!["staff", "guest"].includes(profile.role) || typeof fundId !== "string") return false;
  if (!Object.hasOwn(profile, "fundIds")) return true;
  return Array.isArray(profile.fundIds) && profile.fundIds.includes(fundId);
}
