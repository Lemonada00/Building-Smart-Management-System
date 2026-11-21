import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createUploadAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("聊天图片存储尚未配置。");
  return createClient(getSupabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
