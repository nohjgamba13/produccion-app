type Props = {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
};

export default function MetricCard({ label, value, hint, trend }: Props) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      {trend ? <div className="text-xs text-blue-600 mt-2">{trend}</div> : null}
      {hint ? <div className="text-xs text-gray-500 mt-1">{hint}</div> : null}
    </div>
  );
}
