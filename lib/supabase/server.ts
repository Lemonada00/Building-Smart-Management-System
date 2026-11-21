import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function createClient() {
  // SDK 初始化会读取当前时间；认证客户端只在真实请求中创建。
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component 不能写 Cookie，由 Proxy 刷新并回写会话。
        }
      },
    },
  });
}
