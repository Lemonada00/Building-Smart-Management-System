import {
  ArrowLeft,
  Bot,
  ClipboardList,
  LayoutDashboard,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireIdentity } from "@/lib/auth/context";
import { pages, roleNames } from "@/lib/auth/types";

export default function WorkspacePage(props: {
  params: Promise<{ section: string[] }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <WorkspaceContent {...props} />
    </Suspense>
  );
}

async function WorkspaceContent({
  params,
}: {
  params: Promise<{ section: string[] }>;
}) {
  const path = `/${(await params).section.join("/")}`;
  const page = pages.find((item) => item.href === path);
  if (!page) notFound();
  const { profile, identity } = await requireIdentity(path);
  const allowed = page.roles.includes(identity.role);
  const Icon = !allowed
    ? ShieldAlert
    : path === "/assistant"
      ? Bot
      : path === "/dashboard"
        ? LayoutDashboard
        : ClipboardList;
  return (
    <AppShell
      profile={profile}
      identity={identity}
      title={allowed ? page.title : "无权限访问"}
    >
      <div className="page-heading">
        <div>
          <h1>{allowed ? page.title : "无权限访问"}</h1>
          <p>
            {allowed
              ? `${identity.project_name} · ${roleNames[identity.role]}`
              : "当前登录身份无法访问此页面"}
          </p>
        </div>
        {allowed && <span className="phase-tag">功能准备中</span>}
      </div>
      <section className="feature-placeholder">
        <span className={`placeholder-icon ${allowed ? "" : "denied"}`}>
          <Icon size={30} strokeWidth={1.5} />
        </span>
        <h2>
          {!allowed
            ? "此页面不在当前身份的权限范围内"
            : path === "/assistant"
              ? "智能助手，尚未开放"
              : `${page.title}，尚未开放`}
        </h2>
        <p>
          {!allowed
            ? "你可以返回智能助手。如需切换项目或角色，请先退出登录，再选择对应身份。"
            : path === "/assistant"
              ? "这里将支持施工知识问答、现场问题报事与工单进度查询。当前已完成登录与身份功能，助手将在后续阶段开放。"
              : "登录与项目身份已就绪，该功能将在后续开发阶段开放。你可以通过左侧菜单继续浏览。"}
        </p>
        {!allowed ? (
          <Button asChild className="return-button">
            <Link href="/assistant">
              <ArrowLeft size={16} />
              返回智能助手
            </Link>
          </Button>
        ) : (
          <div className="placeholder-status">
            <span />
            当前身份已确认，可安全浏览工作空间
          </div>
        )}
      </section>
    </AppShell>
  );
}
