import { redirect } from "next/navigation";
import { Suspense } from "react";
import Loading from "@/app/loading";
import { LoginForm } from "@/components/auth/login-form";
import { Brand } from "@/components/brand";
import { getLoginContext } from "@/lib/auth/context";
import { safeTarget } from "@/lib/auth/types";

export default function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <LoginContent {...props} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeTarget((await searchParams).next);
  const context = await getLoginContext();
  if (context?.activeIdentity && context.profile) redirect(next);
  if (context) redirect(`/select-identity?next=${encodeURIComponent(next)}`);
  return (
    <main className="auth-page">
      <div className="login-container">
        <Brand />
        <section className="login-panel">
          <h1>登录</h1>
          <div className="title-rule" />
          <LoginForm next={next} />
        </section>
        <p className="login-footnote">使用已分配的工号登录，开始项目协作</p>
      </div>
    </main>
  );
}
