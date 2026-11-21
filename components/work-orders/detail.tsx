import type { ReactNode } from "react";
import { Photos } from "@/components/work-orders/photos";
import { Records } from "@/components/work-orders/records";
import {
  disciplineNames,
  formatTime,
  severityNames,
  statusNames,
  type WorkOrderDetail,
} from "@/lib/work-orders/types";
export function Badges({
  order,
}: {
  order: Pick<WorkOrderDetail, "status" | "severity">;
}) {
  return (
    <>
      <span className={`wo-badge wo-status-${order.status}`}>
        {statusNames[order.status]}
      </span>
      <span className={`wo-badge wo-severity-${order.severity}`}>
        {severityNames[order.severity]}
      </span>
    </>
  );
}
export function WorkOrderContent({
  order,
  editor,
}: {
  order: WorkOrderDetail;
  editor?: ReactNode;
}) {
  return (
    <article className="wo-detail">
      <header className="wo-detail-heading">
        <div className="wo-meta">
          <span className="wo-number">#{order.number}</span>
          <Badges order={order} />
        </div>
        <h1>{order.description}</h1>
      </header>
      <section className="wo-section">
        <h2>基础信息</h2>
        <dl className="wo-info">
          {[
            ["所属项目", order.project.name],
            ["发起人", order.creator.name],
            ["当前责任人", order.assignee.name],
            ["创建时间", formatTime(order.createdAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {editor ?? (
        <section className="wo-section">
          <h2>问题信息</h2>
          <dl className="wo-info">
            <div>
              <dt>专业类型</dt>
              <dd>{disciplineNames[order.discipline]}</dd>
            </div>
            <div>
              <dt>详细位置</dt>
              <dd>{order.location}</dd>
            </div>
          </dl>
          <h3>问题描述</h3>
          <p>{order.description}</p>
          <h3>问题详情</h3>
          <p>{order.details || "未填写"}</p>
          <h3>现场图片</h3>
          <Photos photos={order.photos} />
        </section>
      )}
      <section className="wo-section">
        <h2>当前周期处理信息</h2>
        <h3>问题归因</h3>
        <p>{order.rootCause || "未填写"}</p>
        <h3>预防建议</h3>
        <p>{order.prevention || "未填写"}</p>
      </section>
      <Records records={order.records} people={order.people} />
    </article>
  );
}
