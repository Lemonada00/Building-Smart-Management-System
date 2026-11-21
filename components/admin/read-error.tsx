"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AdminReadError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="wo-empty">
      <h2>工单读取失败</h2>
      <p>筛选条件和输入已保留，请稍后重试。</p>
      <button
        type="button"
        className="wo-primary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "正在重试…" : "重试"}
      </button>
    </section>
  );
}
