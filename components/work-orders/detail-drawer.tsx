"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DetailController } from "@/components/work-orders/detail-controller";
import type { WorkOrderDetail } from "@/lib/work-orders/types";

type State =
  | { kind: "loading" }
  | { kind: "ok"; data: WorkOrderDetail }
  | { kind: "error"; message: string; code: string };
export function DetailDrawer({
  number,
  onClose,
  onUpdated,
}: {
  number: number;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const locked = useRef(false);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt 用于触发用户显式重试。
  useEffect(() => {
    const controller = new AbortController();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked.current) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    fetch(`/api/work-orders/${number}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (controller.signal.aborted) return;
        setState(
          response.ok
            ? { kind: "ok", data: body.data }
            : {
                kind: "error",
                message: body.error.message,
                code: body.error.code,
              },
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            kind: "error",
            message: "工单读取失败，请重试。",
            code: "READ_FAILED",
          });
      });
    return () => {
      controller.abort();
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [number, attempt, onClose]);
  return (
    <div className="wo-overlay">
      <button
        type="button"
        className="wo-backdrop"
        aria-label="关闭详情遮罩"
        onClick={() => {
          if (!locked.current) onClose();
        }}
      />
      <section
        className="wo-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`工单 #${number} 详情`}
      >
        <div className="wo-drawer-top">
          <span>工单详情</span>
          <button
            type="button"
            onClick={() => {
              if (!locked.current) onClose();
            }}
          >
            关闭 ×
          </button>
        </div>
        {state.kind === "loading" ? (
          <p className="wo-feedback">正在加载工单详情…</p>
        ) : state.kind === "ok" ? (
          <DetailController
            initial={state.data}
            onAccessLost={onClose}
            onUpdated={onUpdated}
            onLockChange={(value) => {
              locked.current = value;
            }}
          />
        ) : (
          <div className="wo-feedback">
            <h2>{state.message}</h2>
            {state.code === "READ_FAILED" && (
              <button
                type="button"
                onClick={() => {
                  setState({ kind: "loading" });
                  setAttempt((value) => value + 1);
                }}
              >
                重试
              </button>
            )}
            {state.code === "UNAUTHENTICATED" && (
              <Link
                href={`/login?next=${encodeURIComponent(`/work-orders/${number}`)}`}
              >
                重新登录
              </Link>
            )}
            {state.code === "IDENTITY_REQUIRED" && (
              <Link
                href={`/select-identity?next=${encodeURIComponent(`/work-orders/${number}`)}`}
              >
                选择身份
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
