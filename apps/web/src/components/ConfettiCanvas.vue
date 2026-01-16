<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  active: boolean;
  durationMs?: number;
  mode?: "rain" | "burst";
  // 爆炸原点（相对 host 的 0..1）
  origin?: { x: number; y: number };
}>();

const hostEl = ref<HTMLDivElement | null>(null);
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let stopTimer: number | null = null;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  alpha: number;
  phase: number;
};

let particles: Particle[] = [];
let running = false;
let lastT = 0;

const colors = ["#ffd37a", "#ff7a1a", "#b7ffcb", "#78b4ff", "#ff6b9a"];

function resize() {
  if (!hostEl.value || !canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = hostEl.value.clientWidth || 1;
  const h = hostEl.value.clientHeight || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawn(n: number) {
  if (!hostEl.value) return;
  const w = hostEl.value.clientWidth;
  const h = hostEl.value.clientHeight;
  const mode = props.mode ?? "rain";
  const ox = (props.origin?.x ?? 0.5) * w;
  const oy = (props.origin?.y ?? 0.5) * h;
  for (let i = 0; i < n; i++) {
    const size = 6 + Math.random() * 10;
    const color = colors[(Math.random() * colors.length) | 0];
    const phase = Math.random() * Math.PI * 2;

    if (mode === "burst") {
      // 从原点“爆炸”喷出：先向外扩散，再受重力下落
      const angle = Math.random() * Math.PI * 2;
      const speed = 220 + Math.random() * 360;
      const upward = -120 - Math.random() * 220; // 先往上喷一些更像爆炸
      particles.push({
        x: ox + (-12 + Math.random() * 24),
        y: oy + (-12 + Math.random() * 24),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + upward,
        ax: 0,
        ay: 520 + Math.random() * 420,
        drag: 0.985 - Math.random() * 0.01,
        w: size * (0.9 + Math.random() * 1.4),
        h: size * (0.6 + Math.random() * 1.8),
        rot: Math.random() * Math.PI * 2,
        vr: (-3 + Math.random() * 6) * 1.6,
        color,
        alpha: 0.98,
        phase,
      });
      continue;
    }

    particles.push({
      x: Math.random() * w,
      y: -40 - Math.random() * 200,
      vx: -20 + Math.random() * 40,
      vy: 60 + Math.random() * 140,
      ax: -6 + Math.random() * 12,
      ay: 180 + Math.random() * 260,
      drag: 0.992 - Math.random() * 0.005,
      w: size * (0.8 + Math.random() * 1.2),
      h: size * (0.6 + Math.random() * 1.6),
      rot: Math.random() * Math.PI * 2,
      vr: (-2 + Math.random() * 4) * 1.2,
      color,
      alpha: 0.95,
      phase,
    });
  }
}

function clear() {
  particles = [];
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function tick(t: number) {
  raf = requestAnimationFrame(tick);
  if (!ctx || !hostEl.value) return;
  if (!lastT) lastT = t;
  const dt = Math.min((t - lastT) / 1000, 0.033);
  lastT = t;

  const W = hostEl.value.clientWidth;
  const H = hostEl.value.clientHeight;

  ctx.clearRect(0, 0, W, H);

  // 持续补一点新纸片，让雨更自然
  const mode = props.mode ?? "rain";
  if (running && mode === "rain" && particles.length < 220) {
    spawn(4);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]!;
    // 漂移：一点点“空气扰动”
    const time = t / 1000;
    const wind = Math.sin(time * 1.2 + p.x * 0.01 + p.phase) * 18;
    p.vx += (p.ax + wind) * dt;
    p.vy += p.ay * dt;
    // 空气阻力
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy *= Math.pow(p.drag, dt * 60);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;

    // 慢慢淡出（尤其是接近底部时）
    const fade = Math.max(0, Math.min(1, 1 - (p.y - H * 0.65) / (H * 0.45)));
    // 轻微“翻面闪烁”更像纸片
    const flutter = 0.55 + 0.45 * Math.abs(Math.sin(time * 6 + p.phase));
    p.alpha = (0.12 + 0.82 * fade) * flutter;

    // 出界移除
    if (p.y > H + 80 || p.x < -120 || p.x > W + 120) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    // 纸片：矩形 + 高光边（更像纸）
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.globalAlpha = p.alpha * 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.max(1, p.h * 0.12));
    ctx.restore();
  }
}

function start() {
  if (running) return;
  running = true;
  clear();
  const mode = props.mode ?? "rain";
  if (mode === "burst") {
    spawn(180);
  } else {
    spawn(120);
  }
  lastT = 0;
  if (!raf) raf = requestAnimationFrame(tick);

  const duration = props.durationMs ?? 2200;
  if (stopTimer) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    running = false;
    // 让剩余纸片自然落完再停
    window.setTimeout(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
    }, 1200);
  }, duration);
}

function stop() {
  running = false;
  if (stopTimer) window.clearTimeout(stopTimer);
  stopTimer = null;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  clear();
}

onMounted(() => {
  canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  hostEl.value!.appendChild(canvas);
  ctx = canvas.getContext("2d", { alpha: true })!;
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(hostEl.value!);
  onBeforeUnmount(() => ro.disconnect());
});

watch(
  () => props.active,
  (v) => {
    if (v) start();
    else stop();
  },
  { immediate: true },
);

onBeforeUnmount(() => stop());
</script>

<template>
  <div ref="hostEl" class="host" />
</template>

<style scoped>
.host {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
</style>


