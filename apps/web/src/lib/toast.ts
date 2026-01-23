import { reactive } from "vue";

export type ToastLevel = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  level: ToastLevel;
  message: string;
  createdAt: number;
  durationMs: number;
};

export const toastState = reactive({
  items: [] as ToastItem[],
});

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function push(level: ToastLevel, message: string, durationMs = 1400) {
  const item: ToastItem = {
    id: uid(),
    level,
    message,
    createdAt: Date.now(),
    durationMs,
  };
  toastState.items.push(item);

  window.setTimeout(() => {
    const idx = toastState.items.findIndex((x) => x.id === item.id);
    if (idx >= 0) toastState.items.splice(idx, 1);
  }, durationMs);
}

export const toast = {
  info: (message: string, durationMs?: number) => push("info", message, durationMs),
  success: (message: string, durationMs?: number) => push("success", message, durationMs),
  error: (message: string, durationMs?: number) => push("error", message, durationMs ?? 1800),
  clear: () => {
    toastState.items.splice(0, toastState.items.length);
  },
};


