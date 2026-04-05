type Row = {
  tipo: string;
  id: string;
  nombre: string;
  fecha_entrega: string;
  estado: string;
  etapa: string;
};

type Props = {
  rows: Row[];
};

export default function UpcomingDeliveriesTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">Nombre</th>
            <th className="py-2 pr-3">Entrega</th>
            <th className="py-2 pr-3">Estado</th>
            <th className="py-2 pr-3">Etapa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.tipo}-${row.id}`} className="border-b last:border-0">
              <td className="py-2 pr-3">{row.tipo}</td>
              <td className="py-2 pr-3">{row.nombre}</td>
              <td className="py-2 pr-3">{row.fecha_entrega}</td>
              <td className="py-2 pr-3">{row.estado}</td>
              <td className="py-2 pr-3">{row.etapa}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="text-sm text-gray-500 py-4">
          No hay entregas próximas en los próximos 14 días.
        </div>
      )}
    </div>
  );
}
