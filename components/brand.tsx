import { Construction } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <span className="brand-mark">
        <Construction size={24} strokeWidth={1.7} />
      </span>
      <div>
        <p className="brand-title">建筑施工质检情报员</p>
        {!compact && <p className="brand-subtitle">让现场问题，形成协作闭环</p>}
      </div>
    </div>
  );
}
