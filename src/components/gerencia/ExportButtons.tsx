type Props = {
  onExportProd: () => void;
  onExportStore: () => void;
  onExportCombined: () => void;
};

export default function ExportButtons({
  onExportProd,
  onExportStore,
  onExportCombined,
}: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button className="border px-4 py-2 rounded-xl bg-white" onClick={onExportProd}>
        Exportar producción
      </button>
      <button className="border px-4 py-2 rounded-xl bg-white" onClick={onExportStore}>
        Exportar pedidos tienda
      </button>
      <button className="border px-4 py-2 rounded-xl bg-white" onClick={onExportCombined}>
        Exportar consolidado
      </button>
    </div>
  );
}
