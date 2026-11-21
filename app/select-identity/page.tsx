import { redirect } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { IdentityForm } from "@/components/auth/identity-form";
import { LogoutForm } from "@/components/auth/logout-form";
import { Brand } from "@/components/brand";
import { getLoginContext } from "@/lib/auth/context";
import { safeTarget } from "@/lib/auth/types";

export default function IdentityPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <IdentityContent {...props} />
    </Suspense>
  );
}

async function IdentityContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeTarget((await searchParams).next);
  const context = await getLoginContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (context.activeIdentity && context.profile) redirect(next);
  const unavailable = context.selected || !context.profile;
  return (
    <main className="auth-page identity-page">
      <div className="identity-container">
        <Brand />
        <section
          className="identity-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="identity-title"
        >
          <h1 id="identity-title">
            {unavailable ? "当前身份已不可用" : "选择本次登录身份"}
          </h1>
          <p className="panel-description">
            {unavailable
              ? "身份配置已变更，请退出后重新登录。"
              : "请选择项目与角色，本次登录仅使用所选身份。"}
          </p>
          {!unavailable && context.memberships.length > 0 ? (
            <IdentityForm identities={context.memberships} next={next} />
          ) : (
            <p className="empty-notice">
              {unavailable
                ? "为确保项目权限正确，当前无法进入应用。"
                : "暂未配置可用身份，请联系项目负责人。"}
            </p>
          )}
          <div className="identity-footer">
            <span>
              {context.profile?.name ?? "已登录用户"}，切换账号请先退出
            </span>
            <LogoutForm />
          </div>
        </section>
      </div>
    </main>
  );
}
