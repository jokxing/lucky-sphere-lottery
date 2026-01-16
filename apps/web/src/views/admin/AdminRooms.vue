<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const rooms = ref<Array<any>>([]);
const loading = ref(false);
const error = ref("");

async function refresh() {
  error.value = "";
  loading.value = true;
  try {
    rooms.value = await api.adminListRooms();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

function statusText(r: any) {
  if (r.closedAt) return "已结束";
  if (Number(r.remainingCount) <= 0) return "已抢完";
  return "进行中";
}

onMounted(refresh);
</script>

<template>
  <section class="stack">
    <FullScreenLoading v-if="loading" text="正在刷新房间列表…" />
    <div class="card">
      <div class="head">
        <h2>朋友圈红包 · 管理</h2>
        <div class="actions">
          <a class="btn" href="/rooms/new">创建新房间</a>
          <button class="btn" @click="refresh" :disabled="loading" :aria-busy="loading">
            <span v-if="loading" class="spinner" aria-hidden="true" />
            {{ loading ? "刷新中…" : "刷新" }}
          </button>
        </div>
      </div>
      <div v-if="error" class="error">错误：{{ error }}</div>
      <div v-if="loading && rooms.length === 0" class="muted">加载中…</div>
    </div>

    <div class="card">
      <h3>房间列表</h3>
      <ul class="list" :class="{ dim: loading }">
        <li v-for="r in rooms" :key="r.roomId" class="item">
          <div class="row">
            <div class="title">
              {{ r.title }}
              <span class="tag" :class="{ closed: !!r.closedAt }">{{ statusText(r) }}</span>
            </div>
            <div class="muted mono">{{ r.roomId }}</div>
          </div>
          <div class="row2">
            <div class="stat">
              <div class="k">剩余</div>
              <div class="v">{{ Number(r.remainingAmount).toFixed(2) }} 元 / {{ r.remainingCount }} 份</div>
            </div>
            <div class="stat">
              <div class="k">总额</div>
              <div class="v">{{ Number(r.totalAmount).toFixed(2) }} 元 / {{ r.totalCount }} 份</div>
            </div>
          </div>
          <div class="links">
            <a :href="`/admin/rooms/${r.roomId}`">管理</a>
            <a :href="`/rooms/${r.roomId}`">参与页</a>
            <a :href="`/rooms/${r.roomId}/board`">榜单</a>
          </div>
        </li>
      </ul>
      <div v-if="!loading && rooms.length === 0" class="muted">暂无房间。</div>
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
.list.dim {
  opacity: 0.65;
  transition: opacity 160ms ease;
}
.list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  gap: 10px;
}
.item {
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  padding: 12px;
  background: rgba(0,0,0,0.14);
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
}
.title {
  font-weight: 800;
}
.tag {
  margin-left: 8px;
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
.row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}
.stat .k {
  opacity: 0.75;
  font-size: 12px;
}
.stat .v {
  margin-top: 2px;
  font-weight: 700;
}
.links {
  display: flex;
  gap: 12px;
  margin-top: 10px;
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
@media (max-width: 640px) {
  .head {
    flex-direction: column;
    align-items: stretch;
  }
  .row2 {
    grid-template-columns: 1fr;
  }
  .actions {
    justify-content: flex-start;
  }
}
</style>


