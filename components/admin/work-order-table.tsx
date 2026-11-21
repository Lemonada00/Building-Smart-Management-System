"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DetailDrawer } from "@/components/work-orders/detail-drawer";
import {
  type AdminFilters,
  type AdminListResult,
  adminDetailHref,
} from "@/lib/admin/types";
import {
  disciplineNames,
  formatTime,
  severityNames,
  statusNames,
} from "@/lib/work-orders/types";

export function AdminWorkOrderTable({
  result,
  filters,
}: {
  result: AdminListResult;
  filters: AdminFilters;
}) {
  const router = useRouter();
  const [number, setNumber] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const close = useCallback(() => setNumber(null), []);
  return (
    <>
      <div className="admin-result-heading">
        <h2>工单结果</h2>
        <span className="wo-count">{result.total} 张工单</span>
      </div>
      {notice && <output className="wo-notice">{notice}</output>}
      {!result.items.length ? (
        <section className="wo-empty admin-empty">
          <h2>当前筛选条件下没有工单</h2>
          <p>调整条件，或清空筛选查看当前项目的全部工单。</p>
          <Link
            href="/admin/work-orders"
            prefetch={false}
            className="wo-return"
          >
            清空筛选
          </Link>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  "工单编号",
                  "状态",
                  "严重程度",
                  "专业类型",
                  "问题描述",
                  "创建时间",
                  "当前责任人",
                  "发起人",
                  "操作",
                ].map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr
                  key={order.number}
                  className={
                    order.severity === "urgent" ? "admin-urgent-row" : ""
                  }
                >
                  <td data-label="工单编号">
                    <Link
                      className="admin-number"
                      prefetch={false}
                      href={adminDetailHref(order.number, filters)}
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
                      #{order.number}
                    </Link>
                  </td>
                  <td data-label="状态">
                    <span className={`wo-badge status-${order.status}`}>
                      {statusNames[order.status]}
                    </span>
                  </td>
                  <td data-label="严重程度">
                    <span
                      className={`admin-severity severity-${order.severity}`}
                    >
                      {severityNames[order.severity]}
                    </span>
                  </td>
                  <td data-label="专业类型">
                    {disciplineNames[order.discipline]}
                  </td>
                  <td data-label="问题描述" className="admin-description">
                    <span title={order.description}>{order.description}</span>
                  </td>
                  <td data-label="创建时间">{formatTime(order.createdAt)}</td>
                  <td data-label="当前责任人">{order.assignee.name}</td>
                  <td data-label="发起人">{order.creator.name}</td>
                  <td data-label="操作">
                    <Link
                      prefetch={false}
                      href={adminDetailHref(order.number, filters)}
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
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {number !== null && (
        <DetailDrawer
          key={number}
          number={number}
          onClose={close}
          onUpdated={() => {
            setNotice("操作成功，工单结果已更新。");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
