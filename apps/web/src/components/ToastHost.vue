<script setup lang="ts">
import { computed } from "vue";
import { toastState } from "../lib/toast";

const items = computed(() => toastState.items);
</script>

<template>
  <Teleport to="body">
    <div class="toastWrap" aria-live="polite" aria-atomic="true">
      <div v-for="t in items" :key="t.id" class="toast" :class="t.level">
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toastWrap {
  position: fixed;
  left: 50%;
  top: calc(12px + env(safe-area-inset-top));
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 24px));
  display: grid;
  gap: 8px;
  z-index: 9999;
  pointer-events: none;
}
.toast {
  pointer-events: none;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(10px);
  box-shadow: var(--cardInset), 0 14px 44px rgba(0, 0, 0, 0.38);
  color: rgba(255, 255, 255, 0.92);
  font-size: 13px;
  line-height: 1.45;
  text-align: center;
}
.toast.success {
  border-color: rgba(255, 211, 122, 0.22);
  color: rgba(255, 241, 194, 0.95);
}
.toast.error {
  border-color: rgba(255, 180, 180, 0.22);
  color: rgba(255, 215, 215, 0.95);
}
</style>


