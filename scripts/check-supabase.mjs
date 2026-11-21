import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

try {
  if (!url || !key) {
    throw new Error(
      "缺少 Supabase URL 或 Publishable Key，请检查 .env.local。",
    );
  }
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase Auth API 返回 HTTP ${response.status}。`);
  }
  const settings = await response.json();
  if (!settings.external || typeof settings.disable_signup !== "boolean") {
    throw new Error("Supabase Auth API 未返回有效的项目设置。");
  }
  console.log(
    "Supabase 项目连接与 Publishable Key 校验成功（Auth 设置接口）。",
  );
  console.log("此命令不验证表权限；数据库连通性需另行执行 SQL 查询。");
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Supabase 连接检查失败。",
  );
  process.exitCode = 1;
}
