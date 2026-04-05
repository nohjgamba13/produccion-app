import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export default function SectionCard({ title, subtitle, children }: Props) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-lg font-semibold">{title}</div>
        {subtitle ? <div className="text-sm text-gray-500">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}
