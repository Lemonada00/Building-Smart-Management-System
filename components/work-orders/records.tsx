import {
  actionNames,
  disciplineNames,
  formatTime,
  severityNames,
  statusNames,
  type WorkOrderRecord,
} from "@/lib/work-orders/types";

const fields: Record<string, string> = {
  photos: "现场图片",
  status: "状态",
  assignee_id: "责任人",
  severity: "严重程度",
  discipline: "专业类型",
  description: "问题描述",
  location: "详细位置",
  details: "问题详情",
  root_cause: "问题归因",
  prevention: "预防建议",
};
function changeValue(
  field: string,
  value: string | null,
  people: Record<string, string>,
) {
  if (value === null) return "未填写";
  const labels: Record<string, string> =
    field === "status"
      ? statusNames
      : field === "severity"
        ? severityNames
        : field === "discipline"
          ? disciplineNames
          : field === "assignee_id"
            ? people
            : {};
  return labels[value] ?? value;
}
export function Records({
  records,
  people,
}: {
  records: WorkOrderRecord[];
  people: Record<string, string>;
}) {
  return (
    <section className="wo-section">
      <h2>
        处理记录 <span className="wo-muted">{records.length}</span>
      </h2>
      {!records.length ? (
        <p className="wo-muted">暂无处理记录</p>
      ) : (
        <ol className="wo-history">
          {records.map((record) => (
            <li key={record.id}>
              <div className="wo-history-heading">
                <strong>{actionNames[record.action]}</strong>
                <time>{formatTime(record.occurredAt)}</time>
              </div>
              <p className="wo-muted">{record.actor.name}</p>
              {record.reason && <p>操作说明：{record.reason}</p>}
              {Object.entries(record.changes).map(([field, change]) => (
                <p key={field} className="wo-change">
                  {fields[field] ?? field}：
                  {changeValue(field, change.before, people)} →{" "}
                  {changeValue(field, change.after, people)}
                </p>
              ))}
              {record.rootCause && <p>问题归因：{record.rootCause}</p>}
              {record.prevention && <p>预防建议：{record.prevention}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
