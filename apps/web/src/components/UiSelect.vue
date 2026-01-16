<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

export type UiSelectOption<T = any> = {
  value: T;
  label: string;
  desc?: string;
  tone?: "default" | "danger";
};

const props = defineProps<{
  modelValue: any;
  options: UiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: any): void;
}>();

const open = ref(false);
const rootEl = ref<HTMLDivElement | null>(null);
const activeIndex = ref(-1);

const selected = computed(() => props.options.find((o) => Object.is(o.value, props.modelValue)));

function close() {
  open.value = false;
  activeIndex.value = -1;
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    const idx = props.options.findIndex((o) => Object.is(o.value, props.modelValue));
    activeIndex.value = idx >= 0 ? idx : 0;
    nextTick(() => {
      // focus 留给按钮即可，不强制抢焦点
    });
  }
}

function choose(i: number) {
  const opt = props.options[i];
  if (!opt) return;
  emit("update:modelValue", opt.value);
  close();
}

function onDocDown(e: MouseEvent) {
  if (!open.value) return;
  const t = e.target as Node | null;
  if (!t) return;
  if (rootEl.value && !rootEl.value.contains(t)) close();
}

function onKeydown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (!open.value) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = Math.min(props.options.length - 1, (activeIndex.value < 0 ? 0 : activeIndex.value + 1));
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = Math.max(0, (activeIndex.value < 0 ? 0 : activeIndex.value - 1));
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex.value >= 0) choose(activeIndex.value);
  }
}

watch(
  () => open.value,
  (v) => {
    if (v) document.addEventListener("mousedown", onDocDown, true);
    else document.removeEventListener("mousedown", onDocDown, true);
  },
  { immediate: true },
);

onBeforeUnmount(() => document.removeEventListener("mousedown", onDocDown, true));
</script>

<template>
  <div ref="rootEl" class="sel" :class="{ disabled: !!disabled, open: open }" @keydown="onKeydown">
    <button class="btn" type="button" :disabled="disabled" @click="toggle">
      <div class="text">
        <!-- 收起态：主说明 + 副说明同一行（不换行） -->
        <div class="line">
          <div class="label">{{ selected?.label || placeholder || "请选择" }}</div>
          <div v-if="selected?.desc" class="descInline">{{ selected.desc }}</div>
        </div>
      </div>
      <div class="chev" aria-hidden="true">▾</div>
    </button>

    <div v-if="open" class="menu" role="listbox">
      <button
        v-for="(o, idx) in options"
        :key="idx"
        class="opt"
        type="button"
        :class="{ active: idx === activeIndex, danger: o.tone === 'danger' }"
        @mouseenter="activeIndex = idx"
        @click="choose(idx)"
      >
        <div class="olabel">{{ o.label }}</div>
        <div v-if="o.desc" class="odesc">{{ o.desc }}</div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sel {
  position: relative;
  width: 100%;
}
.btn {
  width: 100%;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.15);
  color: inherit;
  cursor: pointer;
}
.sel.open .btn {
  border-color: rgba(255, 211, 122, 0.30);
}
.text {
  min-width: 0;
}
.line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.label {
  font-weight: 800;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.descInline {
  font-size: 12px;
  opacity: 0.72;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.chev {
  opacity: 0.75;
  flex: 0 0 auto;
}
.sel.disabled {
  opacity: 0.6;
}
.menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  z-index: 50;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(15, 15, 15, 0.92);
  box-shadow: 0 18px 70px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}
.opt {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.opt:first-child {
  border-top: 0;
}
.opt.active {
  background: rgba(255, 122, 26, 0.10);
}
.opt.danger .olabel {
  color: rgba(255, 180, 180, 0.95);
}
.olabel {
  font-weight: 800;
}
.odesc {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.72;
}
</style>


