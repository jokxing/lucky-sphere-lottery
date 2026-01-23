<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import QRCode from "qrcode";
import { toast } from "../lib/toast";
import { copyToClipboard } from "../lib/clipboard";

type Item = { label: string; url: string };

const props = defineProps<{
  open: boolean;
  title?: string;
  items: Item[];
  defaultIndex?: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const idx = ref(0);
const dataUrl = ref("");
const loading = ref(false);

const safeItems = computed(() => props.items || []);
const active = computed(() => safeItems.value[idx.value] || safeItems.value[0]);

let genTimer: number | null = null;
async function gen() {
  const cur = active.value;
  if (!props.open || !cur?.url) return;
  loading.value = true;
  try {
    dataUrl.value = await QRCode.toDataURL(cur.url, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    });
  } catch (e: any) {
    dataUrl.value = "";
    toast.error("二维码生成失败");
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.items, props.defaultIndex] as const,
  () => {
    idx.value = Math.max(0, Math.min(Number(props.defaultIndex || 0), safeItems.value.length - 1));
    if (genTimer) window.clearTimeout(genTimer);
    // debounce a bit to avoid rapid regen when opening
    genTimer = window.setTimeout(gen, 10);
  },
  { immediate: true, deep: true },
);
watch(
  () => idx.value,
  () => {
    if (genTimer) window.clearTimeout(genTimer);
    genTimer = window.setTimeout(gen, 10);
  },
);

onBeforeUnmount(() => {
  if (genTimer) window.clearTimeout(genTimer);
});

async function copyUrl() {
  const cur = active.value;
  if (!cur?.url) return;
  try {
    await copyToClipboard(cur.url);
    toast.success("已复制链接");
  } catch {
    toast.error("复制失败：请长按手动复制");
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('close')">
      <div class="panel ui-card ui-card--warm" role="dialog" aria-modal="true">
        <div class="head">
          <div class="t">{{ title || "分享二维码" }}</div>
          <button class="x" @click="emit('close')" aria-label="关闭">×</button>
        </div>

        <div class="tabs" v-if="safeItems.length > 1">
          <button
            v-for="(it, i) in safeItems"
            :key="it.label + i"
            class="tab"
            :class="{ on: i === idx }"
            @click="idx = i"
            type="button"
          >
            {{ it.label }}
          </button>
        </div>

        <div class="qrBox">
          <div v-if="loading" class="muted">生成中…</div>
          <img v-else-if="dataUrl" class="qr" :src="dataUrl" alt="二维码" />
          <div v-else class="muted">无可用链接</div>
        </div>

        <div v-if="active?.url" class="urlRow">
          <div class="url mono">{{ active.url }}</div>
          <button class="btn" @click="copyUrl" type="button">复制</button>
        </div>

        <div class="hint ui-hint">
          微信里如果仍提示“请在浏览器访问”，说明域名被风控拦截：
          <br />
          - 让朋友用<strong>系统相机</strong>扫码（外部浏览器打开）更容易成功
          <br />
          - 或长按复制链接，在浏览器粘贴打开
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.62);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 9998;
}
.panel {
  width: min(520px, calc(100vw - 24px));
  padding: 16px;
  border-radius: 18px;
  max-height: calc(100vh - 28px);
  overflow: auto;
  position: relative;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.t {
  font-weight: 900;
  font-size: 16px;
}
.x {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.16);
  color: inherit;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.x:hover {
  border-color: rgba(255, 211, 122, 0.28);
}
.tabs {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.tab {
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.18);
  color: inherit;
  cursor: pointer;
  font-weight: 700;
  opacity: 0.9;
}
.tab.on {
  border-color: rgba(255, 211, 122, 0.28);
  background: rgba(255, 122, 26, 0.10);
  color: rgba(255, 241, 194, 0.95);
  opacity: 1;
}
.qrBox {
  margin-top: 12px;
  display: grid;
  place-items: center;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
}
.qr {
  width: min(256px, calc(100vw - 120px));
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  background: #fff;
  padding: 10px;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.35);
}
.urlRow {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}
.url {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 211, 122, 0.26);
  background: rgba(255, 122, 26, 0.10);
  color: inherit;
  white-space: nowrap;
  cursor: pointer;
  font-weight: 800;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.muted {
  opacity: 0.75;
}
.hint {
  margin-top: 10px;
}
</style>


