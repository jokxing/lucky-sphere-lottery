<script setup lang="ts">
const props = defineProps<{
  text?: string;
}>();
</script>

<template>
  <!--
    Teleport 到 body：避免在 3D 舞台/滤镜/transform 容器内导致 fixed 定位不按视口计算（某些浏览器会出现“不居中”）。
  -->
  <Teleport to="body">
    <div class="overlay" role="status" aria-live="polite" aria-busy="true">
      <div class="panel">
        <div class="ring" aria-hidden="true" />
        <div class="text">{{ props.text || "加载中…" }}</div>
        <div class="sub">请稍候</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: radial-gradient(1200px 700px at 50% 30%, rgba(255, 122, 26, 0.10), transparent 60%),
    radial-gradient(900px 650px at 65% 60%, rgba(255, 211, 122, 0.08), transparent 55%),
    rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}

.panel {
  position: relative;
  width: min(420px, calc(100vw - 48px));
  padding: 18px 16px 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.18));
  box-shadow: 0 24px 90px rgba(0, 0, 0, 0.55);
  overflow: hidden;
}

/* 动态光晕/扫光 */
.panel::before {
  content: "";
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 90deg,
    transparent,
    rgba(255, 211, 122, 0.12),
    rgba(255, 122, 26, 0.14),
    transparent
  );
  animation: sweep 2.2s linear infinite;
  filter: blur(1px);
}
.panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(80% 80% at 30% 20%, rgba(255, 255, 255, 0.08), transparent 65%);
  pointer-events: none;
}

.ring,
.text,
.sub {
  position: relative;
  z-index: 1;
}

.ring {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: conic-gradient(from 0deg, rgba(255, 211, 122, 0.95), rgba(255, 122, 26, 0.95), rgba(255, 211, 122, 0.95));
  animation: spin 0.85s linear infinite;
  margin: 0 auto 10px;
  mask: radial-gradient(farthest-side, transparent 62%, #000 63%);
  -webkit-mask: radial-gradient(farthest-side, transparent 62%, #000 63%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.10) inset, 0 10px 40px rgba(255, 122, 26, 0.10);
}

.text {
  text-align: center;
  font-weight: 900;
  letter-spacing: 0.2px;
}
.sub {
  margin-top: 4px;
  text-align: center;
  opacity: 0.72;
  font-size: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes sweep {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel::before,
  .ring {
    animation: none;
  }
}
</style>


