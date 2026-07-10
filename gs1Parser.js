// Best-effort parser for GS1 barcodes (common on reagent/kit boxes), which
// can encode the product's GTIN (AI 01), batch/lot number (AI 10), and
// expiry date (AI 17) in one code. Not a full GS1 implementation — just
// enough to save re-typing when a supplier's barcode uses these AIs.
// Returns { gtin, lot, expiryDate } with whichever fields were found, or
// null if the text doesn't look like GS1 data (caller should then treat
// the whole scanned text as a plain lot number).

const GS = "\u001d";

function parseYYMMDD(s) {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = Number(s.slice(0, 2));
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

export function parseGS1(text) {
  if (!text) return null;

  // Human-readable bracketed form: "(01)12345678901231(17)261231(10)LOT123"
  const bracketed = [...text.matchAll(/\((\d{2,4})\)([^(]+)/g)];
  if (bracketed.length) {
    const result = {};
    bracketed.forEach(([, ai, val]) => {
      val = val.trim();
      if (ai === "01") result.gtin = val;
      if (ai === "17") result.expiryDate = parseYYMMDD(val) || null;
      if (ai === "10") result.lot = val;
    });
    return Object.keys(result).length ? result : null;
  }

  // Raw AI codes with no separators — reliable for the two fixed-length
  // fields (01 = 14 digits, 17 = 6 digits); a trailing 10 (lot) is taken
  // as "everything after", cut at a literal GS char if present.
  if (text.startsWith("01") && text.length >= 22 && text.slice(16, 18) === "17") {
    const gtin = text.slice(2, 16);
    const exp = text.slice(18, 24);
    const rest = text.slice(24);
    const lot = rest.startsWith("10") ? rest.slice(2).split(GS)[0] : undefined;
    return { gtin, expiryDate: parseYYMMDD(exp), lot };
  }

  return null;
}
