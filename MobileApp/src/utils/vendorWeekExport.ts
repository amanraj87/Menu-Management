import * as XLSX from 'xlsx-js-style';

export type ExportMeal = { name: string; qty: number; unitPrice: number; amount: number };
export type ExportDay = {
  date: string; // display format, e.g. 28/6/2026
  day: string;
  breakfast: ExportMeal[];
  lunch: ExportMeal[];
  dinner: ExportMeal[];
  cancelled: { breakfast: boolean; lunch: boolean; dinner: boolean };
  subtotals: { breakfast: number; lunch: number; dinner: number };
  delivery: number;
  dayTotal: number;
};

const NAVY = 'FF1F3864';
const CREAM = 'FFFDF6E3';
const GREEN = 'FFEAF6EA';
const YELLOW = 'FFFFF200';
const GRID = 'FFBFBFBF';

const edge = { style: 'thin', color: { rgb: GRID } } as const;
const border = { top: edge, bottom: edge, left: edge, right: edge };
const fill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });

type Style = Record<string, unknown>;
type Cell = { v: string | number; t: 's' | 'n'; s?: Style };

const txt = (v: string, s?: Style): Cell => ({ v, t: 's', s });
const num = (v: number, s?: Style): Cell => ({ v, t: 'n', s });
const blank = (s?: Style): Cell => ({ v: '', t: 's', s });

const headerS: Style = {
  fill: fill(NAVY),
  font: { bold: true, color: { rgb: 'FFFFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center' },
  border,
};
const cellS = (bg: string, opts?: { bold?: boolean; right?: boolean }): Style => ({
  fill: fill(bg),
  border,
  ...(opts?.bold ? { font: { bold: true } } : {}),
  ...(opts?.right ? { alignment: { horizontal: 'right' } } : {}),
});
const plainS: Style = { border };
const boldS: Style = { border, font: { bold: true } };
const subAmt: Style = { fill: fill(YELLOW), font: { bold: true }, border, alignment: { horizontal: 'right' } };
const subLabel: Style = { fill: fill(YELLOW), font: { bold: true }, border };

/** Builds the vendor-week workbook (matching the web export) and returns base64. */
export function buildVendorWeekXlsxBase64(days: ExportDay[]): string {
  const rows: Cell[][] = [];

  // Header rows
  rows.push([
    txt('Date', headerS), txt('Day', headerS),
    txt('BREAKFAST', headerS), blank(headerS), blank(headerS), blank(headerS),
    txt('LUNCH', headerS), blank(headerS), blank(headerS), blank(headerS),
    txt('DINNER', headerS), blank(headerS), blank(headerS), blank(headerS),
    txt('Delivery', headerS), txt('Day', headerS),
  ]);
  const sub = (): Cell[] => [txt('Item', headerS), txt('Qty', headerS), txt('Unit Price', headerS), txt('Amount', headerS)];
  rows.push([blank(headerS), blank(headerS), ...sub(), ...sub(), ...sub(), blank(headerS), blank(headerS)]);

  const groups: { key: 'breakfast' | 'lunch' | 'dinner'; bg: string }[] = [
    { key: 'breakfast', bg: CREAM },
    { key: 'lunch', bg: GREEN },
    { key: 'dinner', bg: GREEN },
  ];

  for (const d of days) {
    const lists = {
      breakfast: d.cancelled.breakfast ? [] : d.breakfast,
      lunch: d.cancelled.lunch ? [] : d.lunch,
      dinner: d.cancelled.dinner ? [] : d.dinner,
    };
    const n = Math.max(lists.breakfast.length, lists.lunch.length, lists.dinner.length, 1);

    for (let i = 0; i < n; i++) {
      const row: Cell[] = [
        i === 0 ? txt(d.date, boldS) : blank(plainS),
        i === 0 ? txt(d.day, boldS) : blank(plainS),
      ];
      for (const { key, bg } of groups) {
        if (d.cancelled[key] && i === 0) {
          row.push(txt('Cancelled — kitchen closed', cellS(bg)), blank(cellS(bg)), blank(cellS(bg)), blank(cellS(bg)));
        } else {
          const it = lists[key][i];
          if (it) {
            row.push(txt(it.name, cellS(bg)), num(it.qty, cellS(bg, { right: true })), num(it.unitPrice, cellS(bg, { right: true })), num(it.amount, cellS(bg, { right: true })));
          } else {
            row.push(blank(cellS(bg)), blank(cellS(bg)), blank(cellS(bg)), blank(cellS(bg)));
          }
        }
      }
      row.push(blank(plainS), blank(plainS)); // delivery, day (only on subtotal row)
      rows.push(row);
    }

    // Subtotal row
    rows.push([
      blank(plainS), txt('Subtotal', subLabel),
      blank(cellS(CREAM)), blank(cellS(CREAM)), blank(cellS(CREAM)), num(d.cancelled.breakfast ? 0 : d.subtotals.breakfast, subAmt),
      blank(cellS(GREEN)), blank(cellS(GREEN)), blank(cellS(GREEN)), num(d.cancelled.lunch ? 0 : d.subtotals.lunch, subAmt),
      blank(cellS(GREEN)), blank(cellS(GREEN)), blank(cellS(GREEN)), num(d.cancelled.dinner ? 0 : d.subtotals.dinner, subAmt),
      num(d.delivery, subAmt), num(d.dayTotal, subAmt),
    ]);

    rows.push(Array.from({ length: 16 }, () => blank())); // spacer
  }

  // Materialize worksheet — create every cell so fills/borders render.
  const ws: Record<string, unknown> = {};
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 16; c++) {
      const cell = rows[r][c] ?? blank();
      ws[XLSX.utils.encode_cell({ r, c })] = { t: cell.t, v: cell.v, s: cell.s };
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: 15 } });
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },   // Date
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },   // Day
    { s: { r: 0, c: 2 }, e: { r: 0, c: 5 } },   // BREAKFAST
    { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },   // LUNCH
    { s: { r: 0, c: 10 }, e: { r: 0, c: 13 } }, // DINNER
    { s: { r: 0, c: 14 }, e: { r: 1, c: 14 } }, // Delivery
    { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }, // Day
  ];
  ws['!cols'] = [12, 11, 26, 6, 10, 10, 28, 6, 10, 10, 26, 6, 10, 10, 9, 10].map(wch => ({ wch }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Week');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
}
