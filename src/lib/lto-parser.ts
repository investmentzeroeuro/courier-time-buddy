import * as XLSX from "xlsx";

const EXCLUDED_CARRIERS = ["GLS 54", "TEST FOS 54"];

export interface RawRow {
  date: Date;
  month: string;
  carrierName: string;
  login: string;
  isWorkday: boolean;
  dlvPcl: number;
  dlvStps: number;
  czasRejon: number;
}

export interface CarrierMetric {
  month: string;
  carrier: string;
  parcelEfficiency: number;
  stopEfficiency: number;
  avgRouteTime: number;
  avgCouriers: number;
}

export interface ParseResult {
  metrics: CarrierMetric[];
  carriers: string[];
  months: string[];
}

function findColumn(row: Record<string, unknown>, search: string): unknown {
  const s = search.toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().includes(s)) return row[key];
  }
  return undefined;
}

/**
 * Parse time value - FIXED: no cellDates, so times come as fractional numbers (0-1).
 * Multiply by 24 to get hours. Strings like "HH:MM:SS" also handled.
 */
function parseTime(val: unknown): number {
  if (val == null || val === "-" || val === "") return 0;
  if (typeof val === "number") {
    // Excel stores time as fraction of day
    return val * 24;
  }
  if (typeof val === "string") {
    const parts = val.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const sec = parseInt(parts[2], 10) || 0;
      return h + m / 60 + sec / 3600;
    }
    return 0;
  }
  return 0;
}

function parseNumber(val: unknown): number {
  if (val == null || val === "-" || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function countWorkdays(monthStr: string): number {
  const [year, month] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

export function parseExcelData(buffer: ArrayBuffer): RawRow[] {
  // FIXED: cellDates: false — times stay as numbers, no timezone issues
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

  const result: RawRow[] = [];

  for (const row of rows) {
    const typPoj = String(findColumn(row, "typ poj") ?? "").trim().toLowerCase();
    if (typPoj !== "standard") continue;

    const carrierName = String(findColumn(row, "nazwa przewo") ?? "").trim();
    if (!carrierName || EXCLUDED_CARRIERS.includes(carrierName)) continue;

    // Parse month
    const rawMonth = findColumn(row, "miesi");
    let month = "";
    if (rawMonth instanceof Date) {
      month = `${rawMonth.getFullYear()}-${String(rawMonth.getMonth() + 1).padStart(2, "0")}`;
    } else if (typeof rawMonth === "number") {
      // Excel serial date number
      const d = XLSX.SSF.parse_date_code(rawMonth);
      if (d) month = `${d.y}-${String(d.m).padStart(2, "0")}`;
    } else {
      month = String(rawMonth ?? "").slice(0, 7);
    }
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    // Parse date
    const rawDate = row.data ?? findColumn(row, "data");
    let date: Date;
    if (rawDate instanceof Date) {
      date = rawDate;
    } else if (typeof rawDate === "number") {
      const d = XLSX.SSF.parse_date_code(rawDate);
      if (d) {
        date = new Date(d.y, d.m - 1, d.d);
      } else {
        continue;
      }
    } else {
      date = new Date(String(rawDate));
    }
    if (isNaN(date.getTime())) continue;

    const dow = date.getDay();
    const isWorkday = dow >= 1 && dow <= 5;

    const login = String(findColumn(row, "login") ?? "").trim();
    if (login.toUpperCase().includes("NODATA") || login === "") continue;

    result.push({
      date,
      month,
      carrierName,
      login,
      isWorkday,
      dlvPcl: parseNumber(findColumn(row, "dlv_pcl")),
      dlvStps: parseNumber(findColumn(row, "dlv_stps")),
      czasRejon: parseTime(findColumn(row, "czas rejon")),
    });
  }

  return result;
}

function findFullMonthCarriers(workdayRows: RawRow[]): Set<string> {
  const carrierMonthDates = new Map<string, Map<string, Set<string>>>();

  for (const row of workdayRows) {
    if (!row.isWorkday) continue;
    if (!carrierMonthDates.has(row.carrierName)) {
      carrierMonthDates.set(row.carrierName, new Map());
    }
    const months = carrierMonthDates.get(row.carrierName)!;
    if (!months.has(row.month)) months.set(row.month, new Set());
    months.get(row.month)!.add(row.date.toISOString().slice(0, 10));
  }

  const result = new Set<string>();
  for (const [carrier, months] of carrierMonthDates) {
    for (const [month, dates] of months) {
      if (dates.size >= countWorkdays(month)) {
        result.add(carrier);
        break;
      }
    }
  }
  return result;
}

export function calculateMetrics(data: RawRow[]): ParseResult {
  const workdayRows = data.filter((r) => r.isWorkday);
  const fullMonthCarriers = findFullMonthCarriers(workdayRows);
  const filtered = workdayRows.filter((r) => fullMonthCarriers.has(r.carrierName));

  const groups = new Map<string, RawRow[]>();
  for (const row of filtered) {
    const key = `${row.carrierName}||${row.month}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const metrics: CarrierMetric[] = [];
  const carrierSet = new Set<string>();
  const monthSet = new Set<string>();

  for (const [key, rows] of groups) {
    const [carrier, month] = key.split("||");
    carrierSet.add(carrier);
    monthSet.add(month);

    // Count unique dates and logins per date for avg couriers
    const dateLogins = new Map<string, Set<string>>();
    for (const r of rows) {
      const d = r.date.toISOString().slice(0, 10);
      if (!dateLogins.has(d)) dateLogins.set(d, new Set());
      dateLogins.get(d)!.add(r.login);
    }
    const uniqueDays = dateLogins.size;
    const totalLogins = Array.from(dateLogins.values()).reduce((s, v) => s + v.size, 0);
    const avgCouriers = uniqueDays > 0 ? totalLogins / uniqueDays : 0;

    const dlvRows = rows.filter((r) => r.dlvPcl > 0);
    const totalPcl = rows.reduce((s, r) => s + r.dlvPcl, 0);
    const totalStps = rows.reduce((s, r) => s + r.dlvStps, 0);

    const timeRows = rows.filter((r) => r.czasRejon > 0);
    const avgTime = timeRows.length > 0
      ? timeRows.reduce((s, r) => s + r.czasRejon, 0) / timeRows.length
      : 0;

    metrics.push({
      month,
      carrier,
      parcelEfficiency: dlvRows.length > 0 ? totalPcl / dlvRows.length : 0,
      stopEfficiency: dlvRows.length > 0 ? totalStps / dlvRows.length : 0,
      avgRouteTime: Math.round(avgTime * 100) / 100,
      avgCouriers: Math.round(avgCouriers),
    });
  }

  return {
    metrics,
    carriers: Array.from(carrierSet).sort(),
    months: Array.from(monthSet).sort(),
  };
}

export function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  return `${m}.${y}`;
}
