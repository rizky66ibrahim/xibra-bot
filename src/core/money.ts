// Money helpers for IDR amounts typed in chat.

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  rb: 1_000,
  ribu: 1_000,
  jt: 1_000_000,
  juta: 1_000_000,
};

// Accepts: 25k, 25rb, 25 ribu, 1,5jt, 1.5jt, 2jt, 25.000, 1.250.000, 25000.
// Returns whole rupiah, or null when the text is not an amount.
export function parseIdrAmount(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!text) return null;

  const suffixed = /^(\d+(?:[.,]\d+)?)(k|rb|ribu|jt|juta)$/.exec(text);
  if (suffixed) {
    const value = Number(suffixed[1].replace(",", ".")) * MULTIPLIERS[suffixed[2]];
    return value > 0 ? Math.round(value) : null;
  }

  // Thousands separators: 25.000 or 1.250.000
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    const value = Number(text.replace(/[.,]/g, ""));
    return value > 0 ? value : null;
  }

  if (/^\d+$/.test(text)) {
    const value = Number(text);
    return value > 0 ? value : null;
  }

  return null;
}

// "Rp 25.000" or "-Rp 300.000"
export function formatIdr(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(rounded).toLocaleString("id-ID")}`;
}

// Quantity of an asset (shares, grams, coins). Comma or dot is the decimal mark: 100, 2, 0,05, 1.25.
// Returns null when the text is not a positive number.
export function parseUnits(input: string): number | null {
  const text = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}
