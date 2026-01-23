<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ApiError, api } from "../../lib/api";
import { getDeviceId } from "../../lib/device";
import { copyToClipboard } from "../../lib/clipboard";
import { toast } from "../../lib/toast";
import ThreeLuckySphere from "../../components/ThreeLuckySphere.vue";
import QrShareDialog from "../../components/QrShareDialog.vue";

const route = useRoute();
const roomId = computed(() => String(route.params.roomId || ""));

const accessCode = ref(localStorage.getItem("ROOM_CODE_" + roomId.value) || "");
const name = ref(localStorage.getItem("ROOM_NAME") || "");

const entered = ref(false);
const room = ref<any>(null);
const error = ref("");
const loading = ref(false);
const alreadyClaimedAmount = ref<number | null>(null);

const showWinnerCard = ref(false);
const winnerName = ref("");
const confettiOn = ref(false);
const rolling = ref(false);
const rollText = ref("开抽一次");

// share shorter URLs (still same page)
const roomUrl = computed(() => `${location.origin}/r/${roomId.value}`);
const boardUrl = computed(() => `${location.origin}/b/${roomId.value}`);

const qrOpen = ref(false);

async function shareRoom() {
  const url = roomUrl.value;
  const text = `朋友圈红包：点开输入口令即可参与\n口令：${accessCode.value.trim() || "（见页面）"}`;
  try {
    const nav: any = navigator as any;
    if (nav?.share) {
      await nav.share({ title: "朋友圈红包", text, url });
      toast.success("已调起分享");
      return;
    }
  } catch {
    // fall back to copy
  }
  await copy(url);
}

async function copy(text: string) {
  try {
    await copyToClipboard(text);
    toast.success("已复制");
  } catch (e: any) {
    // iOS/微信 webview 可能禁用复制：给出可操作的兜底提示
    toast.error("复制失败：请长按文本手动复制");
  }
}

const fillers = computed(() => {
  const MIN = 72;
  const people = Array.from({ length: MIN }, (_, i) => ({ id: `filler-${i + 1}`, displayName: "" }));
  return people;
});

const remainingText = computed(() => {
  if (!room.value) return "";
  return `${Number(room.value.remainingAmount).toFixed(2)} 元 / ${room.value.remainingCount} 份`;
});

const progress = computed(() => {
  if (!room.value) return 0;
  const total = Number(room.value.totalCount || 0);
  const left = Number(room.value.remainingCount || 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, (total - left) / total));
});

const accessCodeOk = computed(() => /^[0-9]{6}$/.test(accessCode.value.trim()));

async function enter() {
  error.value = "";
  const code = accessCode.value.trim();
  if (!code) {
    error.value = "accessCode_required";
    return;
  }
  if (!accessCodeOk.value) {
    // 后端也会校验，这里先拦截减少一次请求
    error.value = "accessCode_invalid";
    return;
  }
  loading.value = true;
  try {
    const r = await api.enterRoom(roomId.value, { accessCode: code });
    room.value = r;
    entered.value = true;
    alreadyClaimedAmount.value = null;
    localStorage.setItem("ROOM_CODE_" + roomId.value, code);
    if (name.value.trim()) localStorage.setItem("ROOM_NAME", name.value.trim());
  } catch (e: any) {
    const msg = e?.message || String(e);
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

async function claim() {
  error.value = "";
  loading.value = true;
  showWinnerCard.value = false;
  confettiOn.value = false;
  rolling.value = true;
  rollText.value = "开抽中…";
  const startAt = Date.now();
  try {
    if (!name.value.trim()) {
      error.value = "name_required";
      return;
    }
    const r = await api.claimRoom(roomId.value, {
      accessCode: accessCode.value.trim(),
      deviceId: getDeviceId(),
      name: name.value.trim(),
    });

    // 最短动效时长：先转一会儿再揭晓，增加刺激感
    // 抽奖动效更久一点，并带少量随机，体感更“开奖”
    const minRollMs = 2600 + Math.floor(Math.random() * 650);
    const elapsed = Date.now() - startAt;
    if (elapsed < minRollMs) {
      await new Promise((res) => setTimeout(res, minRollMs - elapsed));
    }

    winnerName.value = `${r.amount.toFixed(2)}元`;
    showWinnerCard.value = true;
    confettiOn.value = true;
    setTimeout(() => (confettiOn.value = false), 2200);
    alreadyClaimedAmount.value = r.amount;
    // 刷新房间状态
    room.value = await api.enterRoom(roomId.value, { accessCode: accessCode.value.trim() });
  } catch (e: any) {
    if (e instanceof ApiError) {
      if (e.code === "already_claimed") {
        const amt = Number(e.data?.amount);
        alreadyClaimedAmount.value = Number.isFinite(amt) ? amt : null;
        error.value = "already_claimed";
        return;
      }
      error.value = e.code;
      return;
    }
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
    // 给一点点缓冲，让“开奖→弹卡”更连贯
    setTimeout(() => {
      rolling.value = false;
      rollText.value = "开抽一次";
    }, 200);
  }
}

watch(
  () => roomId.value,
  () => {
    entered.value = false;
    room.value = null;
    error.value = "";
    showWinnerCard.value = false;
    winnerName.value = "";
    confettiOn.value = false;
    alreadyClaimedAmount.value = null;
    accessCode.value = localStorage.getItem("ROOM_CODE_" + roomId.value) || "";
  },
  { immediate: true },
);
</script>

<template>
  <div class="wrap">
    <QrShareDialog
      :open="qrOpen"
      title="分享二维码"
      :items="[
        { label: '参与页', url: roomUrl },
        { label: '榜单', url: boardUrl },
      ]"
      @close="qrOpen = false"
    />
    <div class="bg3d">
      <ThreeLuckySphere
        :people="fillers"
        :highlight-ids="[]"
        :running="rolling"
        :winner-name="winnerName"
        :show-winner-card="showWinnerCard"
        :confetti-active="confettiOn"
      />
    </div>

    <!-- mobile：上方信息卡（把信息从底部抽屉拆出去，避免“集中一坨”） -->
    <div class="topCard">
      <div class="panelHeader">
        <div>
          <div class="brand">朋友圈红包 <span class="badge">虚拟</span></div>
          <div class="sub">房间号 <span class="mono">{{ roomId }}</span></div>
        </div>
        <div class="headerActions">
          <button class="chip" @click="shareRoom" title="一键分享房间链接">一键分享</button>
          <button class="chip" @click="qrOpen = true" title="生成二维码分享">二维码</button>
          <button class="chip" @click="copy(roomUrl)" title="复制房间链接">复制链接</button>
          <button class="chip" @click="copy(boardUrl)" title="复制榜单链接">复制榜单</button>
        </div>
      </div>

      <div v-if="room" class="stats">
        <div class="stat">
          <div class="k">剩余</div>
          <div class="v">{{ remainingText }}</div>
        </div>
        <div class="bar">
          <div class="barFill" :style="{ width: `${progress * 100}%` }" />
        </div>
      </div>
    </div>

    <div class="panel" :class="{ rolling: rolling }">
      <div class="panelHeader">
        <div>
          <div class="brand">朋友圈红包 <span class="badge">虚拟</span></div>
          <div class="sub">房间号 <span class="mono">{{ roomId }}</span></div>
        </div>
        <div class="headerActions">
          <button class="chip" @click="shareRoom" title="一键分享房间链接">一键分享</button>
          <button class="chip" @click="qrOpen = true" title="生成二维码分享">二维码</button>
          <button class="chip" @click="copy(roomUrl)" title="复制房间链接">复制链接</button>
          <button class="chip" @click="copy(boardUrl)" title="复制榜单链接">复制榜单</button>
        </div>
      </div>

      <div v-if="room" class="stats">
        <div class="stat">
          <div class="k">剩余</div>
          <div class="v">{{ remainingText }}</div>
        </div>
        <div class="bar">
          <div class="barFill" :style="{ width: `${progress * 100}%` }" />
        </div>
      </div>

      <div v-if="error" class="error">
        <template v-if="error === 'already_claimed'">
          你已经抽过一次了<span v-if="alreadyClaimedAmount !== null">：{{ alreadyClaimedAmount.toFixed(2) }} 元</span>。
        </template>
        <template v-else-if="error === 'accessCode_required'">请先输入 6 位口令。</template>
        <template v-else-if="error === 'accessCode_invalid'">口令不正确。</template>
        <template v-else-if="error === 'room_closed'">房间已结束。</template>
        <template v-else-if="error === 'no_candidates'">已经被抢完了。</template>
        <template v-else-if="error === 'name_required'">请先填写昵称。</template>
        <template v-else>错误：{{ error }}</template>
      </div>

      <div v-if="!entered" class="form">
        <div class="field">
          <div class="labelRow">
            <label>6 位口令</label>
            <button class="linkBtn" @click="copy(accessCode)" type="button">复制口令</button>
          </div>
          <input
            v-model="accessCode"
            inputmode="numeric"
            maxlength="6"
            placeholder="例如：123456"
          />
        </div>

        <div class="field">
          <label>昵称</label>
          <input v-model="name" maxlength="20" placeholder="用于榜单展示" />
        </div>

        <button class="primary" @click="enter" :disabled="loading">进入房间</button>
      </div>

      <div v-else class="form">
        <div class="field">
          <label>昵称</label>
          <input v-model="name" maxlength="20" />
        </div>

        <div class="actions">
          <button
            class="primary"
            @click="claim"
            :disabled="loading || rolling || room?.remainingCount <= 0 || error === 'already_claimed'"
          >
            {{
              error === "already_claimed"
                ? "已抽过"
                : room?.remainingCount <= 0
                  ? "已抢完"
                  : rolling
                    ? "开抽中…"
                    : "开抽一次"
            }}
          </button>
          <button class="ghost" @click="showWinnerCard = false" v-if="showWinnerCard">收起结果卡</button>
        </div>

        <div class="links">
          <a class="link" :href="`/rooms/${roomId}/board`">查看榜单</a>
          <button class="linkBtn" @click="copy(roomUrl)" type="button">复制房间链接</button>
          <button class="linkBtn" @click="copy(boardUrl)" type="button">复制榜单链接</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  position: fixed;
  inset: 0;
}
.bg3d {
  position: absolute;
  inset: 0;
}
.topCard {
  display: none;
}
.panel {
  position: absolute;
  left: 16px;
  top: 16px;
  width: min(420px, calc(100vw - 32px));
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.22));
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 60px rgba(0,0,0,0.45);
  transition: opacity 240ms ease, transform 240ms ease;
}
.panel.rolling {
  opacity: 0;
  pointer-events: none;
  transform: translateY(14px);
}
.panelHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.panelHeader > div:first-child {
  min-width: 0;
}
.brand {
  font-size: 18px;
  font-weight: 1000;
  letter-spacing: 0.5px;
}
.badge {
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 211, 122, 0.25);
  background: rgba(255, 122, 26, 0.12);
  color: rgba(255, 241, 194, 0.95);
  vertical-align: middle;
}
.sub {
  margin-top: 6px;
  opacity: 0.75;
  font-size: 12px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.headerActions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap; /* 允许换行：避免按钮过多时挤爆 */
  justify-content: flex-end;
  align-items: center;
}
.chip {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  opacity: 0.92;
  font-size: 12px;
  font-weight: 750;
  white-space: nowrap; /* PC：按钮文案不换行 */
}
.chip:hover {
  border-color: rgba(255, 211, 122, 0.28);
}
.stats {
  margin-top: 12px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.03);
}
.stat .k {
  opacity: 0.7;
  font-size: 12px;
}
.stat .v {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.5px;
}
.bar {
  margin-top: 10px;
  height: 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}
.barFill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 122, 26, 0.9), rgba(255, 211, 122, 0.9));
}
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 180, 180, 0.20);
  background: rgba(255, 0, 0, 0.06);
}
.form {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
label {
  font-size: 12px;
  opacity: 0.85;
}
.labelRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}
.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
input {
  width: 100%;
  box-sizing: border-box; /* 修复：width=100% + padding/border 造成溢出 */
  padding: 12px 12px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.20);
  color: inherit;
}
.primary,
.ghost {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 900;
}
.primary {
  border-color: rgba(255, 211, 122, 0.30);
  background: radial-gradient(900px 260px at 30% 20%, rgba(255, 122, 26, 0.22), transparent 60%),
    rgba(255, 255, 255, 0.06);
}
.ghost {
  font-weight: 700;
  opacity: 0.9;
}
.actions {
  display: grid;
  gap: 8px;
}
.links {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 6px;
}
.link {
  opacity: 0.9;
}
.linkBtn {
  background: transparent;
  border: 0;
  color: inherit;
  opacity: 0.75;
  text-decoration: underline;
  cursor: pointer;
}

/* mobile */
@media (max-width: 640px) {
  .topCard {
    display: grid;
    gap: 6px;
    position: absolute;
    left: 12px;
    right: 12px;
    top: 12px;
    padding: 10px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.10);
    background: linear-gradient(180deg, rgba(0,0,0,0.26), rgba(0,0,0,0.08));
    backdrop-filter: blur(10px);
    box-shadow: 0 16px 60px rgba(0,0,0,0.35);
  }
  /* mobile 顶部卡：保持横向（左标题 / 右二维码按钮） */
  .topCard .panelHeader {
    flex-direction: row;
    align-items: center;
  }
  /* 顶部信息卡做“薄”：隐藏房间号行、减少复制按钮占位，让 3D 更突出 */
  .topCard .sub {
    display: none;
  }
  .topCard .headerActions {
    display: flex;
    gap: 8px;
    flex-wrap: nowrap;
    margin-left: auto;
  }
  /* mobile 顶部卡：只保留一个“二维码”入口，避免按钮占位过大 */
  .topCard .headerActions .chip {
    flex: 0 0 auto;
    min-height: 34px;
    padding: 6px 10px;
  }
  .topCard .headerActions .chip:not(:nth-child(2)) {
    display: none;
  }
  .topCard .stats {
    margin-top: 0;
    padding: 8px 10px;
  }
  .topCard .stat .v {
    font-size: 16px;
  }
  .topCard .bar {
    height: 6px;
  }
  .panel {
    left: 12px;
    right: 12px;
    top: auto;
    bottom: 12px;
    width: auto;
    padding: 12px;
    border-radius: 20px;
    max-height: 34vh;
    overflow: auto;
  }
  .panelHeader {
    flex-direction: column;
    align-items: stretch;
  }
  /* mobile：底部操作卡不再重复展示头部/进度条，避免堆叠 */
  .panel .panelHeader,
  .panel .stats {
    display: none;
  }
  .headerActions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  .chip {
    flex: 1 1 auto;
    min-height: 42px;
  }
  input {
    font-size: 16px; /* iOS 防止自动放大 */
  }
  .links {
    flex-wrap: wrap;
  }
}
</style>


