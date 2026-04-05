import { DateRange } from "@/lib/gerencia";

type Props = {
  range: DateRange;
  setRange: (value: DateRange) => void;
  saleChannel: string;
  setSaleChannel: (value: string) => void;
  pedidoStatus: string;
  setPedidoStatus: (value: string) => void;
  stores: { id: string; nombre: string | null; ciudad: string | null }[];
  storeId: string;
  setStoreId: (value: string) => void;
  onReset: () => void;
};

export default function GerenciaFilters({
  range,
  setRange,
  saleChannel,
  setSaleChannel,
  pedidoStatus,
  setPedidoStatus,
  stores,
  storeId,
  setStoreId,
  onReset,
}: Props) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-700 mb-3">Filtros globales</div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div>
          <label className="text-sm text-gray-600">Desde</label>
          <input
            type="date"
            className="w-full border rounded-xl px-3 py-2 bg-white mt-1"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">Hasta</label>
          <input
            type="date"
            className="w-full border rounded-xl px-3 py-2 bg-white mt-1"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-600">Canal producción</label>
          <select
            className="w-full border rounded-xl px-3 py-2 bg-white mt-1"
            value={saleChannel}
            onChange={(e) => setSaleChannel(e.target.value)}
          >
            <option value="__all__">Todos</option>
            <option value="web">web</option>
            <option value="apps">apps</option>
            <option value="personalizados">personalizados</option>
            <option value="tienda_fisica">tienda_fisica</option>
            <option value="institucional">institucional</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600">Estado pedido tienda</label>
          <select
            className="w-full border rounded-xl px-3 py-2 bg-white mt-1"
            value={pedidoStatus}
            onChange={(e) => setPedidoStatus(e.target.value)}
          >
            <option value="__all__">Todos</option>
            <option value="draft">draft</option>
            <option value="pending_review">pending_review</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="delivered">delivered</option>
            <option value="closed">closed</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600">Tienda</label>
          <select
            className="w-full border rounded-xl px-3 py-2 bg-white mt-1"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            <option value="__all__">Todas</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.nombre ?? "-"}{store.ciudad ? ` · ${store.ciudad}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button className="border px-4 py-2 rounded-xl bg-white" onClick={onReset}>
          Reiniciar filtros
        </button>
      </div>
    </div>
  );
}
