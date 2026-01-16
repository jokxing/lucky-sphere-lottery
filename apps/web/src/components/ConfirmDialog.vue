<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";

const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === "Escape") emit("cancel");
}

watch(
  () => props.open,
  (v) => {
    // 打开时锁滚动，避免背景滚动穿透
    if (v) document.documentElement.style.overflow = "hidden";
    else document.documentElement.style.overflow = "";
  },
  { immediate: true },
);

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.documentElement.style.overflow = "";
});
</script>

<template>
  <div v-if="open" class="overlay" role="dialog" aria-modal="true">
    <div class="backdrop" @click="emit('cancel')" />
    <div class="panel">
      <div class="head">
        <div class="title">{{ title }}</div>
      </div>
      <div v-if="description" class="desc">{{ description }}</div>

      <div class="actions">
        <button class="btn ghost" @click="emit('cancel')">{{ cancelText || "取消" }}</button>
        <button class="btn" :class="{ danger: danger }" @click="emit('confirm')">
          {{ confirmText || (danger ? "确认删除" : "确定") }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
}
.backdrop {
  position: absolute;
  inset: 0;
  /* 确认弹窗不要“背景元素/氛围光晕”，只保留干净遮罩（氛围留给 loading） */
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
}
.panel {
  position: relative;
  width: min(520px, calc(100vw - 48px));
  border-radius: 18px;
  border: 1px solid rgba(255, 211, 122, 0.18);
  /* 弹窗本体用“单一主题色”做轻微铺底（不加背景元素/动效） */
  background:
    radial-gradient(900px 260px at 18% 15%, rgba(255, 122, 26, 0.18), transparent 60%),
    rgba(18, 18, 18, 0.78);
  box-shadow: 0 28px 110px rgba(0, 0, 0, 0.65);
  padding: 16px;
  overflow: hidden;
}
.head,
.desc,
.actions {
  position: relative;
  z-index: 1;
}
.title {
  font-weight: 1000;
  letter-spacing: 0.2px;
}
.desc {
  margin-top: 10px;
  opacity: 0.85;
  line-height: 1.55;
}
.actions {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
.btn {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  cursor: pointer;
  font-weight: 800;
  white-space: nowrap;
}
.btn.ghost {
  background: rgba(0, 0, 0, 0.18);
}
.btn.danger {
  border-color: rgba(255, 180, 180, 0.25);
  background: rgba(255, 0, 0, 0.10);
}
</style>


