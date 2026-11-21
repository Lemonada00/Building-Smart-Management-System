"use client";
import { ArrowUpRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Badges } from "@/components/work-orders/detail";
import { DetailDrawer } from "@/components/work-orders/detail-drawer";
import {
  detailHref,
  disciplineNames,
  type Filters,
  formatTime,
  type WorkOrderSummary,
} from "@/lib/work-orders/types";
export function WorkOrderList({
  orders,
  filters,
  initialNotice = "",
}: {
  orders: WorkOrderSummary[];
  filters: Filters;
  initialNotice?: string;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState(initialNotice);
  const [number, setNumber] = useState<number | null>(null);
  const close = useCallback(() => setNumber(null), []);
  if (!orders.length)
    return (
      <>
        {notice && <output className="wo-notice">{notice}</output>}
        <div className="wo-empty">
          <h2>当前筛选条件下没有工单</h2>
          <p>可以切换状态，查看其他工单。</p>
        </div>
      </>
    );
  return (
    <>
      {notice && <output className="wo-notice">{notice}</output>}
      <div className="wo-list">
        {orders.map((order) => (
          <Link
            prefetch={false}
            key={order.number}
            href={detailHref(order.number, filters)}
            className={`wo-card ${order.severity === "urgent" ? "wo-urgent" : ""}`}
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
                setNumber(order.number);
              }
            }}
          >
            <div className="wo-card-top">
              <div className="wo-meta">
                <span className="wo-number">#{order.number}</span>
                <Badges order={order} />
              </div>
              <ArrowUpRight size={18} />
            </div>
            {order.photos[0] && (
              <Image
                className="wo-list-photo"
                src={order.photos[0].url}
                alt={order.photos[0].name}
                width={160}
                height={100}
                unoptimized
              />
            )}
            <h2>{order.description}</h2>
            <p className="wo-location">
              <MapPin size={14} />
              {order.location}
            </p>
            <div className="wo-card-footer">
              <span>{formatTime(order.createdAt)}</span>
              <span>责任人 · {order.assignee.name}</span>
              <span>{disciplineNames[order.discipline]}</span>
            </div>
          </Link>
        ))}
      </div>
      {number !== null && (
        <DetailDrawer
          key={number}
          number={number}
          onClose={close}
          onUpdated={() => {
            setNotice("操作成功，列表已更新。");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
