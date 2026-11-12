const INVISIBLE_CHARACTERS = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("th-TH");
}

export function matchesSearch(query, text) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedText = normalizeSearchText(text);
  const textDigits = normalizedText.replace(/\D/g, "");
  return normalizedQuery.split(" ").every((term) => {
    if (normalizedText.includes(term)) return true;
    const termDigits = term.replace(/\D/g, "");
    return termDigits.length > 0 && textDigits.includes(termDigits);
  });
}
