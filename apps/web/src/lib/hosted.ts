function envHosted(): boolean {
  const v = String((import.meta as any).env?.VITE_HOSTED_MODE || "").trim();
  return v === "1" || v.toLowerCase() === "true";
}

function queryHosted(): boolean {
  try {
    const u = new URL(window.location.href);
    const v = String(u.searchParams.get("hosted") || "").trim();
    return v === "1" || v.toLowerCase() === "true";
  } catch {
    return false;
  }
}

// 托管模式：用于“别人直接用我部署跑”的 C 端入口
// - 通过构建环境变量 VITE_HOSTED_MODE=1 开启（推荐）
// - 或临时用 URL 参数 ?hosted=1 开启（便于测试）
export function isHostedMode(): boolean {
  return envHosted() || queryHosted();
}


