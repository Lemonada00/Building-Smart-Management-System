"use client";
import { useEffect, useState } from "react";
import { getWorkOrderAssignees } from "@/app/actions/work-orders";
import type { Assignee, Operation } from "@/lib/work-orders/types";
export const operationNames: Record<Operation, string> = {
  edit: "编辑",
  resolve: "解决",
  reject: "拒绝",
  assign: "指派他人",
  reopen: "重新打开",
};
export function OperationDialog({
  action,
  number,
  busy,
  error,
  onSubmit,
  onClose,
  onReload,
}: {
  action: Exclude<Operation, "edit">;
  number: number;
  busy: boolean;
  error: string;
  onSubmit: (data: Record<string, string>) => void;
  onClose: () => void;
  onReload: () => void;
}) {
  const [people, setPeople] = useState<Assignee[] | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (action !== "assign") return;
    let live = true;
    getWorkOrderAssignees(number)
      .then((r) => {
        if (!live) return;
        if (r.ok) setPeople(r.data);
        else setLoadError(r.error.message);
      })
      .catch(() => {
        if (live) setLoadError("施工方读取失败，请关闭后重试。");
      });
    return () => {
      live = false;
    };
  }, [action, number]);
  return (
    <div className="wo-modal-overlay">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={operationNames[action]}
        className="wo-modal"
      >
        <h2>{operationNames[action]}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = Object.fromEntries(
              new FormData(e.currentTarget),
            ) as Record<string, string>;
            onSubmit(data);
          }}
        >
          {action === "resolve" ? (
            <>
              <label>
                问题归因 *<textarea name="rootCause" required rows={4} />
              </label>
              <label>
                预防建议（选填）
                <textarea name="prevention" rows={3} />
              </label>
            </>
          ) : (
            <>
              {action === "assign" && (
                <label>
                  新责任施工方 *
                  <select
                    name="assigneeId"
                    required
                    disabled={busy || !people?.length}
                  >
                    <option value="">
                      {people === null ? "正在读取…" : "请选择施工方"}
                    </option>
                    {people?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.employeeId} · {p.department}
                      </option>
                    ))}
                  </select>
                  {people?.length === 0 && (
                    <span>当前项目没有其他可指派施工方。</span>
                  )}
                  {loadError && <span role="alert">{loadError}</span>}
                </label>
              )}
              <label>
                {action === "reject"
                  ? "拒绝原因"
                  : action === "reopen"
                    ? "重新打开原因"
                    : "指派原因"}{" "}
                *<textarea name="reason" required rows={4} />
              </label>
            </>
          )}
          {error && (
            <p className="wo-form-error" role="alert">
              {error}
            </p>
          )}
          {error && (
            <button type="button" disabled={busy} onClick={onReload}>
              加载最新内容后核对
            </button>
          )}
          <div className="wo-form-buttons">
            <button type="button" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button
              className="wo-primary"
              type="submit"
              disabled={busy || (action === "assign" && !people?.length)}
            >
              {busy ? "正在提交…" : `确认${operationNames[action]}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
