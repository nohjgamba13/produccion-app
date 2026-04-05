export type Role = "admin" | "supervisor" | "operator" | "ventas_tienda" | null;

export type ProduccionOrder = {
  id: string;
  client_name: string | null;
  sale_channel: string | null;
  quantity: number | null;
  due_date: string | null;
  status: string | null;
  current_stage: string | null;
  created_at: string | null;
};

export type PedidoTienda = {
  id: string;
  tienda_id: string | null;
  fecha_entrega: string | null;
  status: string | null;
  current_stage: string | null;
  notas: string | null;
  created_at: string | null;
};

export type Tienda = {
  id: string;
  nombre: string | null;
  ciudad: string | null;
};

export type DateRange = {
  from: string;
  to: string;
};

export function getErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
      error_description?: string;
    };
    return (
      e.message ||
      e.details ||
      e.hint ||
      e.error_description ||
      e.code ||
      JSON.stringify(error)
    );
  }
  return String(error);
}

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getCurrentMonthRange(): DateRange {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
}

export function getPreviousRange(range: DateRange): DateRange {
  const from = new Date(`${range.from}T00:00:00`);
  const to = new Date(`${range.to}T00:00:00`);
  const diffMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - diffMs);
  return {
    from: toDateInputValue(prevFrom),
    to: toDateInputValue(prevTo),
  };
}

export function withinRange(
  dateStr: string | null | undefined,
  from: string,
  to: string
): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

export function isProdCompleted(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "completed";
}

export function isPedidoClosed(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "approved" || s === "delivered" || s === "rejected" || s === "closed";
}

export function diffLabel(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "Sin cambios";
  if (previous === 0) return `+${current}`;
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}% vs rango anterior`;
}

export function safeLower(v: string | null | undefined): string {
  return (v ?? "").toLowerCase();
}

export function sumUnits(rows: ProduccionOrder[]): number {
  return rows.reduce((acc, row) => acc + (row.quantity ?? 0), 0);
}

export function averageUnits(rows: ProduccionOrder[]): number {
  if (!rows.length) return 0;
  return Math.round((sumUnits(rows) / rows.length) * 10) / 10;
}

export function onTimeCountProduccion(rows: ProduccionOrder[], todayISO: string): number {
  return rows.filter((r) => isProdCompleted(r.status) && !!r.due_date && r.due_date >= todayISO).length;
}

export function overdueCountProduccion(rows: ProduccionOrder[], todayISO: string): number {
  return rows.filter((r) => !isProdCompleted(r.status) && !!r.due_date && r.due_date < todayISO).length;
}

export function overdueCountTienda(rows: PedidoTienda[], todayISO: string): number {
  return rows.filter((r) => !isPedidoClosed(r.status) && !!r.fecha_entrega && r.fecha_entrega < todayISO).length;
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number | null | undefined>>
): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => {
    const str = value == null ? "" : String(value);
    return `"${str.replaceAll('"', '""')}"`;
  };
  const csv = [
    headers.map(esc).join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
