"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import GerenciaFilters from "../../components/gerencia/GerenciaFilters";
import ExportButtons from "../../components/gerencia/ExportButtons";
import MetricCard from "../../components/gerencia/MetricCard";
import ProductionSummaryTable from "../../components/gerencia/ProductionSummaryTable";
import SectionCard from "../../components/gerencia/SectionCard";
import StoreOrdersSummaryTable from "../../components/gerencia/StoreOrdersSummaryTable";
import UpcomingDeliveriesTable from "../../components/gerencia/UpcomingDeliveriesTable";
import {
  DateRange,
  PedidoTienda,
  ProduccionOrder,
  Role,
  Tienda,
  averageUnits,
  diffLabel,
  downloadCsv,
  getCurrentMonthRange,
  getErrorMessage,
  getPreviousRange,
  isPedidoClosed,
  isProdCompleted,
  overdueCountProduccion,
  overdueCountTienda,
  safeLower,
  sumUnits,
  toDateInputValue,
  withinRange,
} from "../../lib/gerencia";
import { supabase } from "../../lib/supabaseClient";

export default function GerenciaPage() {
  const currentRange = getCurrentMonthRange();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [role, setRole] = useState<Role>(null);

  const [range, setRange] = useState<DateRange>(currentRange);
  const [saleChannel, setSaleChannel] = useState("__all__");
  const [pedidoStatus, setPedidoStatus] = useState("__all__");
  const [storeId, setStoreId] = useState("__all__");

  const [prodOrders, setProdOrders] = useState<ProduccionOrder[]>([]);
  const [storeOrders, setStoreOrders] = useState<PedidoTienda[]>([]);
  const [stores, setStores] = useState<Record<string, Tienda>>({});

  useEffect(() => {
    void init();
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (profileRes.error) throw profileRes.error;

      const r = (profileRes.data?.role ?? null) as Role;
      setRole(r);

      if (r !== "admin") {
        setErrorMsg("Solo el administrador puede ver el panel gerencial.");
        setLoading(false);
        return;
      }

      const [prodRes, storeRes] = await Promise.all([
        supabase
          .from("ordenes_de_produccion")
          .select("id, client_name, sale_channel, quantity, due_date, status, current_stage, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("pedidos_tienda")
          .select("id, tienda_id, fecha_entrega, status, current_stage, notas, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (prodRes.error) throw prodRes.error;
      if (storeRes.error) throw storeRes.error;

      const prodData = (prodRes.data ?? []) as ProduccionOrder[];
      const storeData = (storeRes.data ?? []) as PedidoTienda[];

      setProdOrders(prodData);
      setStoreOrders(storeData);

      const storeIds = Array.from(
        new Set(storeData.map((x) => x.tienda_id).filter(Boolean))
      ) as string[];

      if (storeIds.length) {
        const tiendasRes = await supabase
          .from("tiendas")
          .select("id, nombre, ciudad")
          .in("id", storeIds);

        if (tiendasRes.error) throw tiendasRes.error;

        const map: Record<string, Tienda> = {};
        for (const t of (tiendasRes.data ?? []) as Tienda[]) {
          map[t.id] = t;
        }
        setStores(map);
      } else {
        setStores({});
      }
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const previousRange = useMemo(() => getPreviousRange(range), [range]);

  const prodFiltered = useMemo(() => {
    return prodOrders
      .filter((o) => withinRange(o.created_at, range.from, range.to))
      .filter((o) => saleChannel === "__all__" ? true : o.sale_channel === saleChannel);
  }, [prodOrders, range, saleChannel]);

  const prodPrevious = useMemo(() => {
    return prodOrders
      .filter((o) => withinRange(o.created_at, previousRange.from, previousRange.to))
      .filter((o) => saleChannel === "__all__" ? true : o.sale_channel === saleChannel);
  }, [prodOrders, previousRange, saleChannel]);

  const storeFiltered = useMemo(() => {
    return storeOrders
      .filter((o) => withinRange(o.created_at, range.from, range.to))
      .filter((o) => pedidoStatus === "__all__" ? true : o.status === pedidoStatus)
      .filter((o) => storeId === "__all__" ? true : o.tienda_id === storeId);
  }, [storeOrders, range, pedidoStatus, storeId]);

  const storePrevious = useMemo(() => {
    return storeOrders
      .filter((o) => withinRange(o.created_at, previousRange.from, previousRange.to))
      .filter((o) => pedidoStatus === "__all__" ? true : o.status === pedidoStatus)
      .filter((o) => storeId === "__all__" ? true : o.tienda_id === storeId);
  }, [storeOrders, previousRange, pedidoStatus, storeId]);

  const storesList = useMemo(
    () => Object.values(stores).sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
    [stores]
  );

  const todayISO = toDateInputValue(new Date());

  const metrics = useMemo(() => {
    const prodActive = prodFiltered.filter((o) => !isProdCompleted(o.status)).length;
    const prodCompleted = prodFiltered.filter((o) => isProdCompleted(o.status)).length;
    const storeActive = storeFiltered.filter((o) => !isPedidoClosed(o.status)).length;
    const storeClosed = storeFiltered.filter((o) => isPedidoClosed(o.status)).length;

    const prodUpcoming7 = prodOrders.filter((o) => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      return (
        withinRange(o.due_date, todayISO, toDateInputValue(future)) &&
        !isProdCompleted(o.status)
      );
    }).length;

    const storeUpcoming7 = storeOrders.filter((o) => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      return (
        withinRange(o.fecha_entrega, todayISO, toDateInputValue(future)) &&
        !isPedidoClosed(o.status)
      );
    }).length;

    const prodOverdue = overdueCountProduccion(prodFiltered, todayISO);
    const storeOverdue = overdueCountTienda(storeFiltered, todayISO);
    const units = sumUnits(prodFiltered);
    const avgUnits = averageUnits(prodFiltered);

    const prodComplianceBase = prodFiltered.filter((o) => !!o.due_date).length;
    const prodCompliance = prodComplianceBase
      ? Math.round(((prodFiltered.filter((o) => isProdCompleted(o.status)).length) / prodComplianceBase) * 100)
      : 0;

    const storeApprovalBase = storeFiltered.length;
    const storeApproval = storeApprovalBase
      ? Math.round(((storeFiltered.filter((o) => safeLower(o.status) === "approved" || safeLower(o.status) === "delivered").length) / storeApprovalBase) * 100)
      : 0;

    return {
      prodActive,
      prodCompleted,
      storeActive,
      storeClosed,
      prodUpcoming7,
      storeUpcoming7,
      prodOverdue,
      storeOverdue,
      units,
      avgUnits,
      prodCompliance,
      storeApproval,
      totalCreated: prodFiltered.length + storeFiltered.length,
      prodActiveTrend: diffLabel(
        prodActive,
        prodPrevious.filter((o) => !isProdCompleted(o.status)).length
      ),
      prodCompletedTrend: diffLabel(
        prodCompleted,
        prodPrevious.filter((o) => isProdCompleted(o.status)).length
      ),
      storeActiveTrend: diffLabel(
        storeActive,
        storePrevious.filter((o) => !isPedidoClosed(o.status)).length
      ),
      storeClosedTrend: diffLabel(
        storeClosed,
        storePrevious.filter((o) => isPedidoClosed(o.status)).length
      ),
    };
  }, [prodFiltered, storeFiltered, prodOrders, storeOrders, prodPrevious, storePrevious, todayISO]);

  const prodByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of prodFiltered) {
      const key = o.sale_channel || "sin_canal";
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([channel, total]) => ({ channel, total }))
      .sort((a, b) => b.total - a.total);
  }, [prodFiltered]);

  const prodByStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of prodFiltered) {
      const key = o.current_stage || "sin_etapa";
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [prodFiltered]);

  const storeByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of storeFiltered) {
      const key = o.status || "sin_estado";
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [storeFiltered]);

  const topStores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of storeFiltered) {
      const name = stores[o.tienda_id ?? ""]?.nombre ?? "Sin tienda";
      map[name] = (map[name] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [storeFiltered, stores]);

  const upcomingRows = useMemo(() => {
    const next14 = new Date();
    next14.setDate(next14.getDate() + 14);
    const next14ISO = toDateInputValue(next14);

    const prod = prodOrders
      .filter((o) => withinRange(o.due_date, todayISO, next14ISO) && !isProdCompleted(o.status))
      .map((o) => ({
        tipo: "produccion",
        id: o.id,
        nombre: o.client_name ?? "-",
        fecha_entrega: o.due_date ?? "-",
        estado: o.status ?? "-",
        etapa: o.current_stage ?? "-",
      }));

    const tienda = storeOrders
      .filter((o) => withinRange(o.fecha_entrega, todayISO, next14ISO) && !isPedidoClosed(o.status))
      .map((o) => ({
        tipo: "pedido_tienda",
        id: o.id,
        nombre: stores[o.tienda_id ?? ""]?.nombre ?? "-",
        fecha_entrega: o.fecha_entrega ?? "-",
        estado: o.status ?? "-",
        etapa: o.current_stage ?? "-",
      }));

    return [...prod, ...tienda].sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega));
  }, [prodOrders, storeOrders, stores, todayISO]);

  if (loading) return <div className="p-6">Cargando panel gerencial...</div>;

  const resetFilters = () => {
    setRange(currentRange);
    setSaleChannel("__all__");
    setPedidoStatus("__all__");
    setStoreId("__all__");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto grid gap-4">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Panel gerencial</h1>
              <div className="text-sm text-gray-600">
                Visión ejecutiva de producción y pedidos tienda. Solo lectura.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link href="/" className="border px-4 py-2 rounded-xl bg-white">
                Volver al tablero
              </Link>
              <ExportButtons
                onExportProd={() =>
                  downloadCsv(
                    "gerencia_produccion.csv",
                    prodFiltered.map((o) => ({
                      id: o.id,
                      cliente: o.client_name ?? "",
                      canal: o.sale_channel ?? "",
                      cantidad: o.quantity ?? 0,
                      entrega: o.due_date ?? "",
                      estado: o.status ?? "",
                      etapa: o.current_stage ?? "",
                      creado: o.created_at ?? "",
                    }))
                  )
                }
                onExportStore={() =>
                  downloadCsv(
                    "gerencia_pedidos_tienda.csv",
                    storeFiltered.map((o) => ({
                      id: o.id,
                      tienda: stores[o.tienda_id ?? ""]?.nombre ?? "",
                      ciudad: stores[o.tienda_id ?? ""]?.ciudad ?? "",
                      entrega: o.fecha_entrega ?? "",
                      estado: o.status ?? "",
                      etapa: o.current_stage ?? "",
                      notas: o.notas ?? "",
                      creado: o.created_at ?? "",
                    }))
                  )
                }
                onExportCombined={() =>
                  downloadCsv(
                    "gerencia_consolidado.csv",
                    [
                      ...prodFiltered.map((o) => ({
                        tipo: "produccion",
                        id: o.id,
                        nombre: o.client_name ?? "",
                        filtro: o.sale_channel ?? "",
                        entrega: o.due_date ?? "",
                        estado: o.status ?? "",
                        etapa: o.current_stage ?? "",
                        creado: o.created_at ?? "",
                      })),
                      ...storeFiltered.map((o) => ({
                        tipo: "pedido_tienda",
                        id: o.id,
                        nombre: stores[o.tienda_id ?? ""]?.nombre ?? "",
                        filtro: stores[o.tienda_id ?? ""]?.ciudad ?? "",
                        entrega: o.fecha_entrega ?? "",
                        estado: o.status ?? "",
                        etapa: o.current_stage ?? "",
                        creado: o.created_at ?? "",
                      })),
                    ]
                  )
                }
              />
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <b>Error:</b> {errorMsg}
            </div>
          )}

          {!errorMsg && (
            <div className="mt-4">
              <GerenciaFilters
                range={range}
                setRange={setRange}
                saleChannel={saleChannel}
                setSaleChannel={setSaleChannel}
                pedidoStatus={pedidoStatus}
                setPedidoStatus={setPedidoStatus}
                stores={storesList}
                storeId={storeId}
                setStoreId={setStoreId}
                onReset={resetFilters}
              />
            </div>
          )}
        </div>

        {!errorMsg && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="Órdenes producción activas"
                value={metrics.prodActive}
                trend={metrics.prodActiveTrend}
              />
              <MetricCard
                label="Órdenes producción completadas"
                value={metrics.prodCompleted}
                trend={metrics.prodCompletedTrend}
              />
              <MetricCard
                label="Pedidos tienda activos"
                value={metrics.storeActive}
                trend={metrics.storeActiveTrend}
              />
              <MetricCard
                label="Pedidos tienda cerrados"
                value={metrics.storeClosed}
                trend={metrics.storeClosedTrend}
              />
              <MetricCard
                label="Producción próxima a entregar"
                value={metrics.prodUpcoming7}
                hint="Próximos 7 días"
              />
              <MetricCard
                label="Pedidos tienda próximos"
                value={metrics.storeUpcoming7}
                hint="Próximos 7 días"
              />
              <MetricCard
                label="Órdenes vencidas producción"
                value={metrics.prodOverdue}
              />
              <MetricCard
                label="Pedidos tienda vencidos"
                value={metrics.storeOverdue}
              />
              <MetricCard
                label="Unidades producción"
                value={metrics.units}
                hint="Dentro del rango"
              />
              <MetricCard
                label="Promedio unidades por orden"
                value={metrics.avgUnits}
              />
              <MetricCard
                label="Cumplimiento producción"
                value={`${metrics.prodCompliance}%`}
              />
              <MetricCard
                label="Aprobación pedidos tienda"
                value={`${metrics.storeApproval}%`}
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SectionCard
                title="Producción por canal"
                subtitle="Distribución del rango seleccionado"
              >
                <ProductionSummaryTable rows={prodByChannel} />
              </SectionCard>

              <SectionCard
                title="Pedidos tienda por estado"
                subtitle="Distribución del rango seleccionado"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 pr-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeByStatus.map((row) => (
                        <tr key={row.name} className="border-b last:border-0">
                          <td className="py-2 pr-3">{row.name}</td>
                          <td className="py-2 pr-3">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {storeByStatus.length === 0 && (
                    <div className="text-sm text-gray-500 py-4">
                      No hay datos para este rango.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SectionCard
                title="Producción por etapa"
                subtitle="Cuellos de botella del rango"
              >
                <div className="grid gap-3">
                  {prodByStage.map((row) => (
                    <div key={row.name} className="border rounded-xl px-3 py-3 flex items-center justify-between">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-sm">{row.total}</div>
                    </div>
                  ))}
                  {prodByStage.length === 0 && (
                    <div className="text-sm text-gray-500">No hay datos para este rango.</div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Top tiendas por pedidos"
                subtitle="Mayor volumen en el rango"
              >
                <StoreOrdersSummaryTable rows={topStores} />
              </SectionCard>
            </div>

            <SectionCard
              title="Entregas próximas"
              subtitle="Producción y pedidos tienda en los próximos 14 días"
            >
              <UpcomingDeliveriesTable rows={upcomingRows} />
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}
