import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 项目自行维护中文 AGENTS.md，避免开发服务自动追加英文说明。
  agentRules: false,
  // 避免开发工具遮挡窄屏侧栏底部的退出按钮。
  devIndicators: { position: "top-right" },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 单张图片最多 10 MiB，为 multipart 边界保留请求体空间。
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
