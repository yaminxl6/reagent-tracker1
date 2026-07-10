import * as XLSX from "xlsx";

const COLUMN_HINTS = {
  name: ["name", "reagent", "item", "اسم"],
  department: ["department", "dept", "section", "قسم"],
  itemType: ["type", "item type", "category"],
  device: ["device", "analyzer", "instrument"],
  lot: ["lot", "batch", "لوت"],
  unit: ["unit", "units", "وحدة"],
  quantity: ["quantity", "qty", "received", "كمية"],
  expiry: ["expiry", "expire", "exp date", "expiration", "انتهاء"],
  threshold: ["threshold", "low stock", "reorder", "alert"],
  receivedBy: ["received by", "receiver", "by"],
  receivedDate: ["received date", "date received", "receipt date"],
};

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase();
}

function guessColumnRoles(headers) {
  const roles = {};
  const used = new Set();
  for (const role of Object.keys(COLUMN_HINTS)) {
    let bestIdx = null;
    headers.forEach((h, i) => {
      if (used.has(i)) return;
      const norm = normalizeHeader(h);
      if (bestIdx === null && COLUMN_HINTS[role].some((kw) => norm.includes(kw))) bestIdx = i;
    });
    if (bestIdx !== null) { roles[role] = bestIdx; used.add(bestIdx); }
  }
  return roles;
}

function parseDate(raw) {
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return "";
  }
  const str = String(raw).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(str);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return "";
}

function extractRowsFromGrid(grid) {
  if (!grid.length) return [];
  const firstRow = grid[0].map(normalizeHeader);
  const looksLikeHeader = firstRow.some((h) => Object.values(COLUMN_HINTS).flat().some((kw) => h.includes(kw)));
  const headerRow = looksLikeHeader ? grid[0] : [];
  const dataRows = looksLikeHeader ? grid.slice(1) : grid;
  const roles = looksLikeHeader ? guessColumnRoles(headerRow) : { name: 0, department: 1, lot: 2, unit: 3, quantity: 4, expiry: 5 };

  const results = [];
  for (const row of dataRows) {
    const name = roles.name !== undefined ? row[roles.name] : row[0];
    if (!name || String(name).trim() === "") continue;
    results.push({
      name: String(name).trim(),
      department: roles.department !== undefined ? String(row[roles.department] ?? "").trim() : "",
      itemType: roles.itemType !== undefined ? String(row[roles.itemType] ?? "").trim() : "Reagent",
      device: roles.device !== undefined ? String(row[roles.device] ?? "").trim() : "",
      lotNumber: roles.lot !== undefined ? String(row[roles.lot] ?? "").trim() : "",
      unit: roles.unit !== undefined ? String(row[roles.unit] ?? "").trim() : "",
      quantityReceived: roles.quantity !== undefined ? String(row[roles.quantity] ?? "").trim() : "",
      expiryDate: roles.expiry !== undefined ? parseDate(row[roles.expiry]) : "",
      lowStockThreshold: roles.threshold !== undefined ? String(row[roles.threshold] ?? "").trim() : "",
      receivedBy: roles.receivedBy !== undefined ? String(row[roles.receivedBy] ?? "").trim() : "",
      receivedDate: roles.receivedDate !== undefined ? parseDate(row[roles.receivedDate]) : "",
    });
  }
  return results;
}

async function parseSpreadsheet(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return extractRowsFromGrid(grid);
}

async function parseWord(file) {
  const mammoth = (await import("mammoth")).default || (await import("mammoth"));
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const grid = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/);
  if (tableMatch) {
    const rowMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/g) || [];
    rowMatches.forEach((rowHtml) => {
      const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g) || [];
      const cells = cellMatches.map((c) => c.replace(/<[^>]+>/g, "").trim());
      if (cells.length) grid.push(cells);
    });
  }
  return extractRowsFromGrid(grid);
}

export async function parseReagentFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext)) return { rows: await parseSpreadsheet(file) };
  if (["docx"].includes(ext)) return { rows: await parseWord(file) };
  throw new Error("Unsupported file type. Use an Excel file (.xlsx/.xls/.csv) or Word (.docx).");
}
