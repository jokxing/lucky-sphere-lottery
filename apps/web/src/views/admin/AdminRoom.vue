<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";

const route = useRoute();
const roomId = computed(() => String(route.params.roomId || ""));

const room = ref<any | null>(null);
const loading = ref(false);
const error = ref("");
const closing = ref(false);
const confirmState = ref<{ open: boolean; title: string; desc: string; onOk?: () => Promise<void> | void }>({
  open: false,
  title: "",
  desc: "",
});

async function refresh() {
  error.value = "";
  loading.value = true;
  try {
    room.value = await api.adminGetRoom(roomId.value);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function closeRoom() {
  confirmState.value = {
    open: true,
    title: "结束房间？",
    desc: "结束后参与者将无法再进入/领取（已领取记录不受影响）。",
    onOk: async () => {
      closing.value = true;
      error.value = "";
      try {
        await api.adminCloseRoom(roomId.value);
        await refresh();
      } catch (e: any) {
        error.value = e?.message || String(e);
      } finally {
        closing.value = false;
      }
    },
  };
}

const status = computed(() => {
  if (!room.value) return "";
  if (room.value.closedAt) return "已结束";
  if (Number(room.value.remainingCount) <= 0) return "已抢完";
  return "进行中";
});

onMounted(refresh);
</script>

<template>
  <section class="stack">
    <FullScreenLoading v-if="loading" text="正在刷新房间详情…" />
    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :description="confirmState.desc"
      danger
      confirm-text="确定结束"
      cancel-text="取消"
      @cancel="confirmState.open = false"
      @confirm="
        async () => {
          const fn = confirmState.onOk;
          confirmState.open = false;
          if (fn) await fn();
        }
      "
    />
    <div class="card">
      <div class="head">
        <div>
          <h2>房间详情</h2>
          <div class="muted mono">{{ roomId }}</div>
        </div>
        <div class="actions">
          <a class="btn" href="/admin/rooms">返回列表</a>
          <button class="btn" @click="refresh" :disabled="loading" :aria-busy="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? "刷新中…" : "刷新" }}
          </button>
        </div>
      </div>
      <div v-if="error" class="error">错误：{{ error }}</div>
      <div v-if="loading && !room" class="muted">加载中…</div>
    </div>

    <div v-if="room" class="card">
      <div class="top">
        <div class="titleRow">
          <div class="title">{{ room.title }}</div>
          <span class="tag" :class="{ closed: !!room.closedAt }">{{ status }}</span>
        </div>
        <div class="grid">
          <div class="kv">
            <div class="k">口令</div>
            <div class="v mono">{{ room.accessCode }}</div>
          </div>
          <div class="kv">
            <div class="k">剩余</div>
            <div class="v">{{ Number(room.remainingAmount).toFixed(2) }} 元 / {{ room.remainingCount }} 份</div>
          </div>
          <div class="kv">
            <div class="k">总额</div>
            <div class="v">{{ Number(room.totalAmount).toFixed(2) }} 元 / {{ room.totalCount }} 份</div>
          </div>
          <div class="kv">
            <div class="k">手气王</div>
            <div class="v" v-if="room.maxWinner">{{ room.maxWinner.name }}（{{ Number(room.maxWinner.amount).toFixed(2) }} 元）</div>
            <div class="muted" v-else>暂无</div>
          </div>
        </div>
      </div>

      <div class="actions2">
        <a class="btn" :href="`/rooms/${room.roomId}`">打开参与页</a>
        <a class="btn" :href="`/rooms/${room.roomId}/board`">打开榜单</a>
        <button class="btn danger" @click="closeRoom" :disabled="closing || !!room.closedAt">
          {{ room.closedAt ? "已结束" : closing ? "结束中…" : "结束房间" }}
        </button>
      </div>
    </div>

    <div v-if="room" class="card">
      <h3>领取记录（{{ room.claims?.length || 0 }}）</h3>
      <div class="muted" v-if="!room.claims?.length">暂无记录。</div>
      <div class="table" v-else>
        <div class="tr th">
          <div>昵称</div>
          <div>金额</div>
          <div class="mono">deviceId</div>
          <div>时间</div>
        </div>
        <div class="tr" v-for="c in room.claims" :key="c.id">
          <div class="name">{{ c.name }}</div>
          <div class="amt">{{ Number(c.amount).toFixed(2) }}</div>
          <div class="mono device">{{ c.deviceId }}</div>
          <div class="time">{{ c.createdAt }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stack {
  display: grid;
  gap: 12px;
}
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
  background: var(--cardBg);
  backdrop-filter: var(--cardBlur);
  box-shadow: var(--cardInset), var(--cardShadow);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.22);
  border-top-color: rgba(255, 211, 122, 0.95);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.btn.danger {
  border-color: rgba(255, 180, 180, 0.25);
  background: rgba(255, 0, 0, 0.08);
}
.muted {
  opacity: 0.75;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.error {
  color: #ffb4b4;
  margin-top: 10px;
}
.titleRow {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.title {
  font-weight: 900;
  font-size: 18px;
}
.tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 211, 122, 0.25);
  background: rgba(255, 122, 26, 0.12);
  color: rgba(255, 241, 194, 0.95);
}
.tag.closed {
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.78);
}
.grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.kv {
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(0,0,0,0.14);
  border-radius: 12px;
  padding: 10px;
}
.k {
  opacity: 0.75;
  font-size: 12px;
}
.v {
  margin-top: 4px;
  font-weight: 800;
}
.actions2 {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.table {
  margin-top: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  overflow: hidden;
}
.tr {
  display: grid;
  grid-template-columns: 140px 90px 1fr 220px;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
  align-items: center;
}
.tr.th {
  border-top: 0;
  background: rgba(255,255,255,0.04);
  font-weight: 700;
  opacity: 0.9;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.amt {
  font-weight: 900;
}
.device {
  opacity: 0.75;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.time {
  opacity: 0.75;
}
@media (max-width: 640px) {
  .head {
    flex-direction: column;
    align-items: stretch;
  }
  .actions {
    justify-content: flex-start;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .tr {
    grid-template-columns: 1fr 90px;
    grid-auto-rows: auto;
  }
  .tr > :nth-child(3),
  .tr > :nth-child(4) {
    display: none;
  }
}
</style>


