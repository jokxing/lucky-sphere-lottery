function envHosted(): boolean {
  const v = String((import.meta as any).env?.VITE_HOSTED_MODE || "").trim();
  return v === "1" || v.toLowerCase() === "true";
}

function queryFlag(name: string): string {
  try {
    const u = new URL(window.location.href);
    return String(u.searchParams.get(name) || "").trim();
  } catch {
    return "";
  }
}

function truthy(v: string): boolean {
  const x = v.trim().toLowerCase();
  return x === "1" || x === "true" || x === "yes" || x === "on";
}

function falsy(v: string): boolean {
  const x = v.trim().toLowerCase();
  return x === "0" || x === "false" || x === "no" || x === "off";
}

export function isAdminMode(): boolean {
  // 给自己留的入口：?admin=1 强制显示全功能入口
  return truthy(queryFlag("admin"));
}

// 托管模式：用于“别人直接用我部署跑”的 C 端入口
// - 通过构建环境变量 VITE_HOSTED_MODE=1 开启（推荐）
// - 或临时用 URL 参数 ?hosted=1 开启（便于测试）
export function isHostedMode(): boolean {
  // 管理模式优先（你自己用）
  if (isAdminMode()) return false;

  // URL 可显式覆盖（便于你调试/对外链接）
  const hosted = queryFlag("hosted");
  if (truthy(hosted)) return true;
  if (falsy(hosted)) return false;

  return envHosted();
}


