type Row = {
  channel: string;
  total: number;
};

type Props = {
  rows: Row[];
};

export default function ProductionSummaryTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-3">Canal</th>
            <th className="py-2 pr-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.channel} className="border-b last:border-0">
              <td className="py-2 pr-3">{row.channel}</td>
              <td className="py-2 pr-3">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div className="text-sm text-gray-500 py-4">No hay datos para este rango.</div>
      )}
    </div>
  );
}
