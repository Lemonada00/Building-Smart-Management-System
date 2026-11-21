"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { type Filters, listHref } from "@/lib/work-orders/types";
export function FiltersBar({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const change = (next: Filters) =>
    startTransition(() => router.replace(listHref(next), { scroll: false }));
  return (
    <div className="wo-filters" aria-busy={pending}>
      <div className="wo-tabs">
        {(
          [
            ["pending", "待处理"],
            ["ended", "已结束"],
            ["all", "全部"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filters.status === value ? "selected" : ""}
            onClick={() => change({ ...filters, status: value })}
            disabled={pending}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="wo-sort">
        排序
        <select
          value={filters.sort}
          onChange={(event) =>
            change({
              ...filters,
              sort: event.target.value === "oldest" ? "oldest" : "newest",
            })
          }
          disabled={pending}
        >
          <option value="newest">最新优先</option>
          <option value="oldest">最旧优先</option>
        </select>
      </label>
      {pending && <span className="wo-muted">正在更新…</span>}
    </div>
  );
}
