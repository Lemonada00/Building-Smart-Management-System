"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="status-page">
      <AlertCircle size={30} />
      <h1>暂时无法加载页面</h1>
      <p>请检查连接后重试。你的身份和权限不会因此改变。</p>
      <Button type="button" onClick={reset}>
        重新加载
      </Button>
      <a href="/login">返回登录入口</a>
    </main>
  );
}
