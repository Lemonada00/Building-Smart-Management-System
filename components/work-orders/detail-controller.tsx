"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { submitWorkOrderCommand } from "@/app/actions/work-orders";
import { WorkOrderContent } from "@/components/work-orders/detail";
import { EditForm } from "@/components/work-orders/edit-form";
import {
  OperationDialog,
  operationNames,
} from "@/components/work-orders/operation-dialog";
import type { Operation, WorkOrderDetail } from "@/lib/work-orders/types";
export function DetailController({
  initial,
  onAccessLost,
  onUpdated,
  onLockChange,
}: {
  initial: WorkOrderDetail;
  onAccessLost?: () => void;
  onUpdated?: () => void;
  onLockChange?: (locked: boolean) => void;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [action, setAction] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    onLockChange?.(action !== null || busy);
    return () => onLockChange?.(false);
  }, [action, busy, onLockChange]);
  async function reload() {
    try {
      const response = await fetch(`/api/work-orders/${order.number}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        setBlocked(true);
        setError(body.error.message);
        return;
      }
      setOrder(body.data);
      setNotice("已加载最新内容，请核对原输入后再提交。");
      setError("");
    } catch {
      setError("最新内容加载失败，请重试。");
    }
  }
  async function submit(payload: Record<string, unknown>) {
    if (busy || blocked || !action) return;
    setBusy(true);
    setError("");
    try {
      const result = await submitWorkOrderCommand({
        number: order.number,
        expectedVersion: order.version,
        action,
        payload,
      });
      if (!result.ok) {
        setError(result.error.message);
        if (
          ["FORBIDDEN", "UNAUTHENTICATED", "IDENTITY_REQUIRED"].includes(
            result.error.code,
          )
        )
          setBlocked(true);
        return;
      }
      setAction(null);
      setNotice(result.unchanged ? "没有修改。" : "操作成功，处理记录已保存。");
      router.refresh();
      onUpdated?.();
      if (result.accessLost) {
        if (onAccessLost) onAccessLost();
        else {
          const query = new URLSearchParams(window.location.search);
          query.set("notice", "assigned");
          router.replace(`/work-orders?${query}`);
        }
        return;
      }
      try {
        const response = await fetch(`/api/work-orders/${order.number}`, {
          cache: "no-store",
        });
        const body = await response.json();
        if (response.ok) setOrder(body.data);
        else {
          setBlocked(true);
          setNotice("操作已成功，但当前详情无法读取，请返回列表。");
        }
      } catch {
        setNotice("操作已成功，详情刷新失败，请加载最新内容。");
      }
    } catch {
      setError("提交结果未能确认，请加载最新记录核对后再操作。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {notice && <output className="wo-notice">{notice}</output>}
      <div className="wo-actions">
        {!blocked &&
          !action &&
          order.allowedActions.map((a) => (
            <button
              key={a}
              type="button"
              className={a === "resolve" ? "wo-primary" : ""}
              onClick={() => {
                setError("");
                setAction(a);
              }}
            >
              {operationNames[a]}
            </button>
          ))}
        <button type="button" disabled={busy} onClick={reload}>
          加载最新内容
        </button>
      </div>
      <WorkOrderContent
        order={order}
        editor={
          action === "edit" ? (
            <EditForm
              order={order}
              busy={busy}
              error={error}
              onSubmit={submit}
              onCancel={() => setAction(null)}
            />
          ) : undefined
        }
      />

      {action && action !== "edit" && (
        <OperationDialog
          action={action}
          number={order.number}
          busy={busy}
          error={error}
          onSubmit={submit}
          onReload={reload}
          onClose={() => {
            if (!busy) setAction(null);
          }}
        />
      )}
      {error && !action && (
        <p className="wo-form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
