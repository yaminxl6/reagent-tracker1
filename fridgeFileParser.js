// Reads a "Reagent inventory" sheet (Excel or Word) matching the paper
// form: a "month: MM-YYYY" line, a "Refrigerator: NAME" line, and a table
// with Item / Unit / Quantity / Expiry date columns, grouped into
// "#DEVICE" section rows. Returns { month, refrigeratorName, rows } where
// rows = [{ device_group, item_name, lot_number, quantity, expiry_date }].

function findHeaderInfo(cellsFlat) {
  let month = "";
  let refrigeratorName = "";
  for (const cell of cellsFlat) {
    const text = String(cell ?? "").trim();
    const monthMatch = text.match(/month\s*:?\s*(\d{2})[-\/](\d{4})/i);
    if (monthMatch && !month) month = `${monthMatch[2]}-${monthMatch[1]}`;
    const fridgeMatch = text.match(/refrigerator\s*:?\s*(.+)/i);
    if (fridgeMatch && !refrigeratorName) refrigeratorName = fridgeMatch[1].trim();
  }
  return { month, refrigeratorName };
}

function parseDate(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }
  const str = String(raw).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
  return null;
}

function extractRowsFromGrid(grid) {
  const cellsFlat = grid.flat();
  const { month, refrigeratorName } = findHeaderInfo(cellsFlat);

  // Find the header row ("Item", "Unit", "Quantity", "Expiry date"...).
  let headerRowIdx = -1;
  for (let i = 0; i < grid.length; i++) {
    const norm = grid[i].map((c) => String(c ?? "").trim().toLowerCase());
    if (norm.includes("item") && (norm.includes("quantity") || norm.includes("unit"))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return { month, refrigeratorName, rows: [] };

  const header = grid[headerRowIdx].map((c) => String(c ?? "").trim().toLowerCase());
  const itemCol = header.indexOf("item");
  const unitCol = header.indexOf("unit");
  const qtyCol = header.indexOf("quantity");
  const expCol = header.findIndex((h) => h.includes("expiry"));

  let currentSection = "";
  const rows = [];
  for (let i = headerRowIdx + 1; i < grid.length; i++) {
    const row = grid[i];
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "");
    if (nonEmpty.length === 0) continue;
    const firstCell = String(row[0] ?? "").trim();
    // A "#DEVICE" style section divider — usually the only non-empty cell in its row.
    if (firstCell.startsWith("#") || (nonEmpty.length === 1 && firstCell)) {
      currentSection = firstCell.replace(/^#/, "").trim();
      continue;
    }
    const itemName = itemCol >= 0 ? String(row[itemCol] ?? "").trim() : "";
    if (!itemName) continue;
    rows.push({
      device_group: currentSection,
      item_name: itemName,
      lot_number: unitCol >= 0 ? String(row[unitCol] ?? "").trim() : "",
      quantity: qtyCol >= 0 ? String(row[qtyCol] ?? "").trim() : "",
      expiry_date: expCol >= 0 ? parseDate(row[expCol]) : null,
    });
  }

  return { month, refrigeratorName, rows };
}

async function parseSpreadsheet(file) {
  const XLSX = await import("xlsx");
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

  // Header info can be plain paragraph text above the table.
  const plainText = html.replace(/<[^>]+>/g, "\n");
  const { month, refrigeratorName } = findHeaderInfo(plainText.split("\n"));

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
  const parsed = extractRowsFromGrid(grid);
  return { month: month || parsed.month, refrigeratorName: refrigeratorName || parsed.refrigeratorName, rows: parsed.rows };
}

export async function parseFridgeFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["xlsx", "xls", "csv"].includes(ext)) return parseSpreadsheet(file);
  if (["docx"].includes(ext)) return parseWord(file);
  throw new Error("Unsupported file type. Use an Excel file (.xlsx/.xls/.csv) or Word (.docx).");
}
