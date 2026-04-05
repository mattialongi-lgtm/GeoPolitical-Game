// Compute flag emoji from ISO2 code using Unicode Regional Indicator Symbols
export const isoToFlag = (iso2: string): string => {
  if (!iso2 || iso2.length < 2) return "🌍";
  const code = iso2.toUpperCase();
  const offset = 127397; // Regional Indicator Symbol offset
  try {
    return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
  } catch {
    return "🌍";
  }
};

export const COUNTRY_FLAGS: Record<string, string> = {
  IT: "🇮🇹", FR: "🇫🇷", DE: "🇩🇪", ES: "🇪🇸", GB: "🇬🇧", US: "🇺🇸", CA: "🇨🇦",
  BR: "🇧🇷", JP: "🇯🇵", CN: "🇨🇳", IN: "🇮🇳", RU: "🇷🇺", AU: "🇦🇺", ZA: "🇿🇦",
  MX: "🇲🇽", AR: "🇦🇷", EG: "🇪🇬", NG: "🇳🇬", TR: "🇹🇷", KR: "🇰🇷", SA: "🇸🇦",
  ID: "🇮🇩", PK: "🇵🇰", PL: "🇵🇱", UA: "🇺🇦", SE: "🇸🇪", NO: "🇳🇴", NL: "🇳🇱",
  BE: "🇧🇪", CH: "🇨🇭", PT: "🇵🇹", GR: "🇬🇷", AT: "🇦🇹", HU: "🇭🇺", CZ: "🇨🇿",
  RO: "🇷🇴", FI: "🇫🇮", DK: "🇩🇰", IE: "🇮🇪", TH: "🇹🇭", VN: "🇻🇳", PH: "🇵🇭",
  MY: "🇲🇾", SG: "🇸🇬", IR: "🇮🇷", IQ: "🇮🇶", IL: "🇮🇱", CO: "🇨🇴", CL: "🇨🇱",
  PE: "🇵🇪", ET: "🇪🇹", KE: "🇰🇪", GH: "🇬🇭", TZ: "🇹🇿", MA: "🇲🇦", DZ: "🇩🇿",
  NZ: "🇳🇿", AF: "🇦🇫",
};

// Get flag: try static map first, then compute from ISO2 code
export const getFlag = (iso2: string): string => {
  const upper = (iso2 || '').toUpperCase();
  // Handle sub-region codes (e.g., "IT-RM" → "IT")
  const countryCode = upper.includes('-') ? upper.split('-')[0] : upper;
  return COUNTRY_FLAGS[countryCode] || isoToFlag(countryCode);
};
