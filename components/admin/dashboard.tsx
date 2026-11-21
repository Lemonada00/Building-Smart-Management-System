import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { type AdminDashboard, adminListHref } from "@/lib/admin/types";
import { severityNames, statusNames } from "@/lib/work-orders/types";
export function Dashboard({ data }: { data: AdminDashboard }) {
  return (
    <div className="admin-dashboard">
      <section className="admin-project">
        <div>
          <span className="admin-section-label">当前项目</span>
          <h2>{data.project.name}</h2>
        </div>
        <dl>
          <div>
            <dt>项目城市</dt>
            <dd>{data.project.city}</dd>
          </div>
          <div>
            <dt>客户名称</dt>
            <dd>{data.project.customerName}</dd>
          </div>
          <div>
            <dt>项目类型</dt>
            <dd>{data.project.projectType}</dd>
          </div>
        </dl>
      </section>
      <div className="admin-metrics">
        <Link prefetch={false} href={adminListHref()} className="admin-metric">
          <span>工单总数</span>
          <strong>{data.total}</strong>
          <small>当前项目全部工单</small>
        </Link>
        {Object.entries(statusNames).map(([status, label]) => (
          <Link
            prefetch={false}
            key={status}
            href={adminListHref({ status: status as keyof typeof statusNames })}
            className={`admin-metric ${status === "pending" ? "admin-metric-pending" : ""}`}
          >
            <span>{label}</span>
            <strong>{data.statuses[status as keyof typeof statusNames]}</strong>
            <small>查看{label}工单</small>
          </Link>
        ))}
      </div>
      <div className="admin-overviews">
        <section className="admin-panel">
          <h2>状态概览</h2>
          <p>当前项目全部工单</p>
          <div className="admin-bars">
            {Object.entries(statusNames).map(([status, label]) => (
              <Link
                key={status}
                prefetch={false}
                href={adminListHref({
                  status: status as keyof typeof statusNames,
                })}
                className={`admin-bar-row status-${status}`}
              >
                <span>{label}</span>
                <span className="admin-bar-track">
                  <span
                    style={{
                      width: data.total
                        ? `${(data.statuses[status as keyof typeof statusNames] / data.total) * 100}%`
                        : "0%",
                    }}
                  />
                </span>
                <strong>
                  {data.statuses[status as keyof typeof statusNames]}
                </strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <h2>待处理风险分布</h2>
          <p>仅统计待处理工单</p>
          <div className="admin-bars">
            {Object.entries(severityNames).map(([severity, label]) => (
              <Link
                key={severity}
                prefetch={false}
                href={adminListHref({
                  status: "pending",
                  severity: severity as keyof typeof severityNames,
                })}
                className={`admin-bar-row severity-${severity}`}
              >
                <span>{label}</span>
                <span className="admin-bar-track">
                  <span
                    style={{
                      width: data.statuses.pending
                        ? `${(data.pendingSeverities[severity as keyof typeof severityNames] / data.statuses.pending) * 100}%`
                        : "0%",
                    }}
                  />
                </span>
                <strong>
                  {
                    data.pendingSeverities[
                      severity as keyof typeof severityNames
                    ]
                  }
                </strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <Link
        prefetch={false}
        href={adminListHref({ status: "pending", severity: "urgent" })}
        className={`admin-focus ${data.pendingUrgent ? "admin-focus-urgent" : ""}`}
      >
        <AlertTriangle size={23} />
        <div>
          <h2>
            重点关注 <strong>{data.pendingUrgent}</strong>
          </h2>
          <p>
            {data.pendingUrgent
              ? `当前有 ${data.pendingUrgent} 张待处理的紧急工单，请优先跟进。`
              : "当前无待处理的紧急工单"}
          </p>
        </div>
        <span>查看工单</span>
      </Link>
    </div>
  );
}
