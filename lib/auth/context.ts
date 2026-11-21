import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import type { LoginContext } from "@/lib/auth/types";
import { safeTarget } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export const getLoginContext = cache(async (): Promise<LoginContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError?.status && authError.status >= 500) {
    throw new Error("登录服务暂不可用，请稍后重试。");
  }
  if (!user) return null;
  const { data, error } = await supabase.rpc("get_login_context");
  if (error?.code === "42501") return null;
  if (error) throw new Error("身份信息加载失败，请重试。");
  return data as LoginContext;
});

export async function requireIdentity(target: string) {
  const context = await getLoginContext();
  const next = encodeURIComponent(safeTarget(target));
  if (!context) redirect(`/login?next=${next}`);
  if (!context.activeIdentity || !context.profile) {
    redirect(`/select-identity?next=${next}`);
  }
  return { profile: context.profile, identity: context.activeIdentity };
}
