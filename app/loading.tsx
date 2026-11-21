import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="status-page">
      <LoaderCircle size={26} className="animate-spin" />
      <p>正在加载，请稍候…</p>
    </main>
  );
}
