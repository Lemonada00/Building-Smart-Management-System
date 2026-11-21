"use client";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
export function AdminRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    startTransition(() => router.refresh());
  }, [router]);
  return (
    <button
      className="admin-refresh"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "正在更新…" : "刷新数据"}
    </button>
  );
}
