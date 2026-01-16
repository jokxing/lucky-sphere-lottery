<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../lib/api";
import ThreeLuckySphere from "../../components/ThreeLuckySphere.vue";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const route = useRoute();
const router = useRouter();
const eventId = computed(() => String(route.params.eventId || ""));

const state = ref<any>(null);
const error = ref("");
const loading = ref(false);
const debug = ref("");

const selectedPrizeId = ref<string>("");
const count = ref<number>(1);

const running = ref(false);
const highlightIds = ref<Set<string>>(new Set());
const focusId = ref<string>("");
const tickerName = ref<string>("准备开始");
const confettiOn = ref(false);
const lastWinners = ref<Array<{ participantId: string; displayName: string }>>([]);
const showWinnerCard = ref(false);

// “重新生成演示数据”是开发/演示用按钮：避免正式活动里误触与困惑
const isDevDemo = computed(() => import.meta.env.DEV && location.hostname === "localhost");

const participants = computed(() => state.value?.participants || []);
const prizes = computed(() => state.value?.prizes || []);
const winsCount = computed(() => (state.value?.wins || []).length);
const remainingCount = computed(() => Math.max(0, participants.value.length - winsCount.value));
const noCandidates = computed(() => remainingCount.value <= 0);

const selectedPrize = computed(() => prizes.value.find((p: any) => p.id === selectedPrizeId.value));

const spherePeople = computed(() => {
  // 人数少时用“无名装饰卡”补满球面，增加氛围（不参与抽奖）
  const base = participants.value as Array<{ id: string; displayName: string }>;
  const MIN = 72;
  const total = Math.max(MIN, base.length);

  // 目标：把“真实名单”均匀撒到 total 个位置里，剩余位置用 filler 填充
  if (base.length === 0) {
    return Array.from({ length: total }, (_, i) => ({ id: `filler-${i + 1}`, displayName: "" }));
  }
  if (base.length >= total) return base;

  const slots: Array<{ id: string; displayName: string } | null> = Array.from({ length: total }, () => null);

  // 等间隔撒点：i -> round(i * (total / base.length))
  // 同时处理碰撞（位置已占用就向后找空位）
  const step = total / base.length;
  for (let i = 0; i < base.length; i++) {
    let idx = Math.round(i * step) % total;
    for (let k = 0; k < total; k++) {
      const j = (idx + k) % total;
      if (!slots[j]) {
        slots[j] = base[i]!;
        break;
      }
    }
  }

  // 填充装饰卡
  let fillN = 1;
  for (let i = 0; i < total; i++) {
    if (!slots[i]) {
      slots[i] = { id: `filler-${fillN++}`, displayName: "" };
    }
  }
  return slots as Array<{ id: string; displayName: string }>;
});

function safeRandomPick(arr: any[]) {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function load() {
  error.value = "";
  debug.value = "";
  loading.value = true;
  try {
    state.value = await api.demoState(eventId.value);
    debug.value = `loaded: prizes=${state.value?.prizes?.length ?? 0}, participants=${state.value?.participants?.length ?? 0}, wins=${state.value?.wins?.length ?? 0}`;
    // 如果当前选中的 prizeId 不属于本活动（比如重置演示数据后），强制切到第一个奖项
    const prizeIds = new Set((prizes.value || []).map((p: any) => p.id));
    if ((!selectedPrizeId.value || !prizeIds.has(selectedPrizeId.value)) && prizes.value.length > 0) {
      selectedPrizeId.value = prizes.value[0].id;
      count.value = prizes.value[0].winnersCount || 1;
    }
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function resetDemo() {
  error.value = "";
  loading.value = true;
  try {
    // 清空旧活动状态，避免 prizeId 沿用导致 prize_not_found
    selectedPrizeId.value = "";
    highlightIds.value = new Set();
    focusId.value = "";
    lastWinners.value = [];
    showWinnerCard.value = false;
    tickerName.value = "准备开始";
    const r = await api.demoBootstrap();
    const id = r?.event?.id;
    if (!id) throw new Error("demo_bootstrap_failed");
    await router.replace(`/events/${id}/draw`);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function startDraw() {
  error.value = "";
  if (!selectedPrizeId.value) {
    error.value = "请选择奖项";
    return;
  }
  if (noCandidates.value) {
    error.value = "no_candidates";
    tickerName.value = "已抽完";
    return;
  }
  running.value = true;
  highlightIds.value = new Set();
  focusId.value = "";
  confettiOn.value = false;
  lastWinners.value = [];
  showWinnerCard.value = false;

  // “氛围”：快速滚动名字（纯前端动画），最后以服务端结果为准
  const start = performance.now();
  const duration = 1800;
  while (performance.now() - start < duration) {
    const p = safeRandomPick(participants.value);
    tickerName.value = p?.displayName || "…";
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 40));
  }

  try {
    const r = await api.demoDraw(eventId.value, {
      prizeId: selectedPrizeId.value,
      count: count.value,
    });
    tickerName.value = "开奖！";
    const winners = (r?.winners || []) as Array<{ participantId: string; displayName: string }>;
    highlightIds.value = new Set(winners.map((w) => w.participantId));
    focusId.value = winners[0]?.participantId || "";
    lastWinners.value = winners;
    showWinnerCard.value = winners.length > 0;
    confettiOn.value = true;
    setTimeout(() => (confettiOn.value = false), 2200);
    await load();
  } catch (e: any) {
    const msg = e?.message || String(e);
    error.value = msg;
    if (msg === "no_candidates") {
      tickerName.value = "已抽完";
    }
  } finally {
    running.value = false;
  }
}

watch(
  () => eventId.value,
  () => {
    // 避免某些情况下 onMounted 未触发/热更新状态丢失导致空白
    // route 变化时清空旧 prizeId，避免 prize_not_found
    selectedPrizeId.value = "";
    highlightIds.value = new Set();
    focusId.value = "";
    lastWinners.value = [];
    showWinnerCard.value = false;
    tickerName.value = "准备开始";
    load();
  },
  { immediate: true },
);
</script>

<template>
  <div class="stageRoot">
    <FullScreenLoading v-if="loading && !state" text="正在加载舞台数据…" />
    <!-- 3D 全屏背景 -->
    <div class="bg3d" v-if="state">
      <ThreeLuckySphere
        :people="spherePeople"
        :highlight-ids="[...highlightIds]"
        :running="running"
        :focus-id="focusId"
        :winner-name="lastWinners[0]?.displayName"
        :show-winner-card="showWinnerCard"
        :confetti-active="confettiOn"
      />
    </div>

    <!-- 叠加 UI -->
    <div class="overlay">
      <header class="top">
        <div class="title">
          <div class="t1">{{ state?.event?.title || "抽奖舞台" }}</div>
          <div class="t2">
            <span class="tag">{{ selectedPrize?.name || "请选择奖项" }}</span>
            <span class="sep">·</span>
            <span>{{ running ? "抽奖中…" : lastWinners.length ? "开奖完成" : "准备开始" }}</span>
          </div>
        </div>
        <div class="topRight">
          <div class="status" v-if="debug">状态：{{ debug }}</div>
          <button class="ghost" @click="load" :disabled="loading">重载</button>
        </div>
      </header>

      <aside class="left">
        <div class="panelTitle">奖项</div>
        <div class="prizeList">
          <button
            v-for="p in prizes"
            :key="p.id"
            class="prizeItem"
            :class="{ active: p.id === selectedPrizeId }"
            @click="selectedPrizeId = p.id; count = p.winnersCount || 1"
            :disabled="running"
          >
            <div class="pName">{{ p.name }}</div>
            <div class="pMeta">默认 {{ p.winnersCount }} 人</div>
          </button>
        </div>

        <div class="muted">剩余可抽人数：{{ remainingCount }}</div>
        <div v-if="error === 'no_candidates'" class="error">
          已经没有可抽的人了（不允许重复中奖）。
        </div>
        <div v-else-if="error" class="error">错误：{{ error }}</div>
        <button v-if="isDevDemo" class="ghost" @click="resetDemo" :disabled="loading" style="width: 100%">
          开发用：重置演示数据
        </button>
        <div v-if="loading && !state" class="muted">加载中…</div>
      </aside>

      <div class="centerHint">
        <div class="big">{{ tickerName }}</div>
      </div>

      <footer class="bottom">
        <div class="ctl">
          <label>本轮人数</label>
          <input v-model.number="count" type="number" min="1" :disabled="running" />
        </div>
        <button class="primary" @click="startDraw" :disabled="running || !selectedPrizeId || noCandidates">
          {{ noCandidates ? "已抽完" : running ? "抽奖中…" : "开始抽奖" }}
        </button>
        <button v-if="showWinnerCard" class="closeWinner" @click="showWinnerCard = false" title="关闭中奖卡">
          关闭中奖卡
        </button>
        <div class="links">
          <a :href="`/events/${eventId}/results`">公开结果</a>
          <a :href="`/events/${eventId}/signup`">报名页</a>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.stageRoot {
  position: fixed;
  inset: 0;
  background: #05070b;
}
.bg3d {
  position: absolute;
  /* 给顶部标题留空间：3D 不再和标题叠在一起 */
  top: 170px;
  left: 0;
  right: 0;
  /* 给底部按钮留安全区：球不要和底部操作叠着 */
  bottom: 90px;
}
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: grid;
  grid-template-columns: 320px 1fr;
  /* 顶部：活动标题；第二行：准备开始/说明；中间：左侧奖项+中奖toast；底部：按钮 */
  grid-template-rows: auto auto 1fr auto;
  gap: 6px;
  padding: 18px;
}
.top {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.title .t1 {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 1px;
}
.title .t2 {
  margin-top: 6px;
  opacity: 0.8;
}
.tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.25);
}
.sep {
  margin: 0 8px;
  opacity: 0.5;
}
.topRight {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status {
  opacity: 0.7;
  font-size: 12px;
}
.ghost {
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}

.left {
  pointer-events: auto;
  grid-row: 3;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  padding: 14px;
  display: grid;
  gap: 10px;
  align-content: start;
  backdrop-filter: blur(8px);
}
.panelTitle {
  font-weight: 900;
  letter-spacing: 1px;
}
.prizeList {
  display: grid;
  gap: 10px;
}
.prizeItem {
  text-align: left;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
}
.prizeItem.active {
  border-color: rgba(255, 211, 122, 0.45);
  background: radial-gradient(500px 160px at 30% 20%, rgba(255, 122, 26, 0.18), transparent 60%),
    rgba(255, 255, 255, 0.04);
}
.pName {
  font-weight: 800;
}
.pMeta {
  opacity: 0.7;
  margin-top: 4px;
  font-size: 12px;
}

.centerHint {
  grid-column: 1 / -1;
  grid-row: 2;
  grid-row: 2;
  justify-self: center;
  align-self: start;
  margin-top: 0;
  text-align: center;
}
.big {
  font-size: 44px;
  font-weight: 1000;
  letter-spacing: 2px;
  text-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
}

.closeWinner {
  pointer-events: auto;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  opacity: 0.9;
  backdrop-filter: blur(10px);
}

.bottom {
  grid-column: 1 / -1;
  grid-row: 4;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}
.ctl {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(10px);
}
input {
  width: 86px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}
.primary {
  padding: 14px 18px;
  border-radius: 18px;
  border: 1px solid rgba(255, 211, 122, 0.35);
  background: radial-gradient(900px 240px at 40% 20%, rgba(255, 122, 26, 0.22), transparent 60%),
    rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 900;
  letter-spacing: 1px;
  min-width: 160px;
}
.links {
  display: flex;
  gap: 14px;
}
.links a {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  opacity: 0.9;
}

@media (max-width: 860px) {
  .bg3d {
    top: 200px;
    bottom: 120px;
  }
  .overlay {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto;
  }
  .left {
    grid-row: 2;
  }
  .centerHint {
    grid-column: 1;
    grid-row: 2;
    margin-top: 0;
  }
  /* closeWinner 在底部操作区，不需要 grid 定位 */
}
</style>


