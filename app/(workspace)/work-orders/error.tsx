"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="wo-feedback">
      <h1>工单读取失败</h1>
      <p>请检查网络后重试。</p>
      <button type="button" onClick={reset}>
        重新加载
      </button>
    </div>
  );
}
