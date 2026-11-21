"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type AdminFilters, adminListHref } from "@/lib/admin/types";
import {
  disciplineNames,
  severityNames,
  statusNames,
} from "@/lib/work-orders/types";

export function AdminFiltersBar({ filters }: { filters: AdminFilters }) {
  const router = useRouter();
  const [draft, setDraft] = useState(filters);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState("");
  const labels = {
    status: "状态",
    severity: "严重程度",
    discipline: "专业",
    keyword: "关键词",
    number: "编号",
  };
  const active = Object.entries(filters).filter(([, value]) => value);
  function navigate(href: string) {
    setFailure("");
    startTransition(async () => {
      try {
        router.push(href, { scroll: false });
        router.refresh();
      } catch {
        setFailure("筛选失败，请重试，已保留输入。");
      }
    });
  }
  return (
    <section className="admin-filter-panel">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate(adminListHref(draft));
        }}
      >
        <div className="admin-filter-grid">
          <label>
            工单状态
            <select
              name="status"
              value={draft.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.target.value as AdminFilters["status"],
                })
              }
            >
              <option value="">全部状态</option>
              {Object.entries(statusNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            严重程度
            <select
              name="severity"
              value={draft.severity}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  severity: event.target.value as AdminFilters["severity"],
                })
              }
            >
              <option value="">全部严重程度</option>
              {Object.entries(severityNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            专业类型
            <select
              name="discipline"
              value={draft.discipline}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  discipline: event.target.value as AdminFilters["discipline"],
                })
              }
            >
              <option value="">全部专业类型</option>
              {Object.entries(disciplineNames).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-search-row">
          <label>
            关键词
            <input
              name="keyword"
              value={draft.keyword}
              placeholder="搜索问题描述、位置或详情"
              onChange={(event) =>
                setDraft({ ...draft, keyword: event.target.value })
              }
            />
          </label>
          <label>
            工单编号
            <input
              name="number"
              value={draft.number}
              placeholder="输入完整编号"
              onChange={(event) =>
                setDraft({ ...draft, number: event.target.value })
              }
            />
          </label>
          <div className="admin-filter-buttons">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft({
                  status: "",
                  severity: "",
                  discipline: "",
                  keyword: "",
                  number: "",
                });
                navigate("/admin/work-orders");
              }}
            >
              清空筛选
            </button>
            <button type="submit" className="wo-primary" disabled={pending}>
              {pending ? "筛选中…" : "筛选"}
            </button>
          </div>
        </div>
      </form>
      <p className="admin-filter-summary" aria-live="polite">
        {pending
          ? "正在读取工单…"
          : active.length
            ? `已生效：${active.map(([key, value]) => `${labels[key as keyof typeof labels]} ${key === "status" ? statusNames[value as keyof typeof statusNames] : key === "severity" ? severityNames[value as keyof typeof severityNames] : key === "discipline" ? disciplineNames[value as keyof typeof disciplineNames] : value}`).join("，")}`
            : "全部工单，未设置筛选条件"}
      </p>
      {failure && <p className="wo-form-error">{failure}</p>}
    </section>
  );
}
