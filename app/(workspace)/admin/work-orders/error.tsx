"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="wo-empty">
      <h2>项目数据读取失败</h2>
      <p>请检查连接后重试，当前地址中的筛选条件已保留。</p>
      <button type="button" className="wo-primary" onClick={reset}>
        重试
      </button>
    </section>
  );
}
