"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type KPI = {
  total: number;
  in_progress: number;
  finished: number;
  on_time: number;
  late: number;
};

export default function ReportsPage() {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [wip, setWip] = useState<Array<{ stage: string; count: number }>>([]);
  const [avgStage, setAvgStage] = useState<Array<{ stage: string; avg_hours: number }>>([]);

  const dateRange = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      date_from: from.toISOString().slice(0, 10),
      date_to: to.toISOString().slice(0, 10),
    };
  }, []);

  useEffect(() => {
    (async () => {
      const k = await supabase.rpc("report_kpis", dateRange);
      const w = await supabase.rpc("report_wip_by_stage");
      const a = await supabase.rpc("report_avg_stage_time", dateRange);

      setKpis((k.data as KPI) ?? null);
      setWip((w.data as any[]) ?? []);
      setAvgStage((a.data as any[]) ?? []);
    })();
  }, [dateRange]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reportes de Producción</h1>
      <p className="text-sm text-gray-600">
        Rango: {dateRange.date_from} → {dateRange.date_to}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card title="Total" value={kpis?.total ?? "-"} />
        <Card title="En proceso" value={kpis?.in_progress ?? "-"} />
        <Card title="Finalizadas" value={kpis?.finished ?? "-"} />
        <Card title="A tiempo" value={kpis?.on_time ?? "-"} />
        <Card title="Tarde" value={kpis?.late ?? "-"} />
      </div>

      <section className="bg-white border rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3">WIP por etapa</h2>
        <div className="space-y-2">
          {wip.map((r) => (
            <Row key={r.stage} left={r.stage} right={r.count} />
          ))}
          {wip.length === 0 && <div className="text-sm text-gray-500">Sin datos</div>}
        </div>
      </section>

      <section className="bg-white border rounded-2xl p-4 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-3">Tiempo promedio por etapa (horas)</h2>
        <div className="space-y-2">
          {avgStage.map((r) => (
            <Row key={r.stage} left={r.stage} right={r.avg_hours} />
          ))}
          {avgStage.length === 0 && <div className="text-sm text-gray-500">Sin datos</div>}
        </div>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function Row({ left, right }: { left: string; right: any }) {
  return (
    <div className="flex items-center justify-between border-b last:border-b-0 py-2">
      <div className="text-gray-700">{left}</div>
      <div className="font-semibold text-gray-900">{right}</div>
    </div>
  );
}