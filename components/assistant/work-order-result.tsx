"use client";
import { ArrowUpRight, ClipboardList, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SearchResult } from "@/lib/assistant/types";
import { severityNames, statusNames } from "@/lib/work-orders/types";

export function WorkOrderLink({
  number,
  onOpen,
  children,
  className,
}: {
  number: number;
  onOpen: (number: number) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      className={className}
      prefetch={false}
      href={`/work-orders/${number}`}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          window.matchMedia("(min-width: 1024px)").matches
        ) {
          event.preventDefault();
          onOpen(number);
        }
      }}
    >
      {children}
    </Link>
  );
}

export function WorkOrderResult({
  result,
  onOpen,
}: {
  result: SearchResult;
  onOpen?: (number: number) => void;
}) {
  if (result.kind !== "ok")
    return (
      <p>
        {result.kind === "forbidden"
          ? "当前身份无法查看该工单。"
          : "未找到该工单。"}
      </p>
    );
  if (!result.total) return <p>当前权限范围内未找到匹配工单。</p>;
  return (
    <section className="chat-orders">
      <header className="chat-orders-heading">
        <ClipboardList size={18} />
        <h3>工单查询</h3>
        <span>共 {result.total} 条</span>
      </header>
      <ul className="chat-order-list">
        {result.items.map((order) => (
          <li
            className="chat-order-card"
            data-severity={order.severity}
            key={order.number}
          >
            <div className="chat-order-heading">
              <strong>工单 #{order.number}</strong>
              <span className="chat-order-status" data-status={order.status}>
                {statusNames[order.status]}
              </span>
            </div>
            <p className="chat-order-description">{order.description}</p>
            <div className="chat-order-meta">
              <span>
                <MapPin size={14} />
                {order.location}
              </span>
              <span>
                <UserRound size={14} />
                {order.assignee.name}
              </span>
              <span className="chat-order-severity">
                {severityNames[order.severity]}
              </span>
            </div>
            <div className="chat-order-footer">
              {onOpen ? (
                <WorkOrderLink
                  className="chat-order-link"
                  number={order.number}
                  onOpen={onOpen}
                >
                  查看详情 <ArrowUpRight size={15} />
                </WorkOrderLink>
              ) : (
                <span className="chat-caption">
                  查看详情 <ArrowUpRight size={15} />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {result.hasMore && (
        <p className="chat-caption">本次展示前 20 条，请补充条件缩小范围。</p>
      )}
    </section>
  );
}
