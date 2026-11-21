"use server";

import { redirect } from "next/navigation";
import { closeChat } from "@/lib/assistant/uploads";
import type { FormState, LoginContext } from "@/lib/auth/types";
import { safeTarget } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

export async function login(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const employeeId = String(form.get("employeeId") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  const target = safeTarget(form.get("next"));
  if (!/^[a-z0-9-]{2,32}$/.test(employeeId) || !password) {
    return { message: "请填写有效工号和密码。", employeeId };
  }
  let next = target;
  try {
    const supabase = await createClient();
    // 已确定身份的会话不能通过重新提交登录表单绕过退出流程。
    const { data: existing } = await supabase.auth.getUser();
    if (existing.user) {
      const { data } = await supabase.rpc("get_login_context");
      if ((data as LoginContext | null)?.selected) {
        return {
          message: "本次登录身份已确定，请先退出登录再切换身份。",
          employeeId,
        };
      }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: `${employeeId}@demo.architecture.invalid`,
      password,
    });
    if (error) {
      return {
        message:
          error.status === 400
            ? "工号或密码错误，请重新输入。"
            : "登录暂未成功，请稍后重试。",
        employeeId,
      };
    }
    const { data, error: contextError } =
      await supabase.rpc("get_login_context");
    if (contextError)
      return { message: "登录成功，身份加载失败，请重试。", employeeId };
    const context = data as LoginContext;
    if (context.memberships.length === 1 && context.profile) {
      const { error: selectionError } = await supabase.rpc("choose_identity", {
        membership_id: context.memberships[0].id,
      });
      if (selectionError)
        return { message: "身份确认失败，请重试。", employeeId };
    } else {
      next = `/select-identity?next=${encodeURIComponent(target)}`;
    }
  } catch {
    return { message: "连接登录服务失败，请稍后重试。", employeeId };
  }
  redirect(next);
}

export async function selectIdentity(
  _state: FormState,
  form: FormData,
): Promise<FormState> {
  const id = String(form.get("membershipId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { message: "请选择有效身份。" };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { message: "登录已失效，请退出后重新登录。" };
    const { error } = await supabase.rpc("choose_identity", {
      membership_id: id,
    });
    if (error)
      return {
        message:
          error.code === "42501" ? error.message : "身份选择失败，请重试。",
      };
  } catch {
    return { message: "身份选择失败，请检查连接后重试。" };
  }
  redirect(safeTarget(form.get("next")));
}

export async function logout(
  _state: FormState,
  _form: FormData,
): Promise<FormState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: context } = await supabase.rpc("get_login_context");
      if ((context as LoginContext | null)?.activeIdentity) await closeChat();
      const { error } = await supabase.rpc("revoke_login_identity");
      if (error) return { message: "退出失败，请稍后重试。" };
    }
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { message: "会话退出未完成，请重试。" };
  } catch {
    return { message: "退出失败，请检查连接后重试。" };
  }
  redirect("/login");
}
