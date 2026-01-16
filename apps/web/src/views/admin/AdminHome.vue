<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const adminKey = ref(localStorage.getItem("ADMIN_KEY") || "dev-admin");
const events = ref<Array<any>>([]);
const loading = ref(false);
const error = ref("");

const form = ref({
  title: "春节抽奖",
  joinMode: "BOTH" as "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH",
  accessCode: "6666",
});

function saveAdminKey() {
  localStorage.setItem("ADMIN_KEY", adminKey.value.trim());
}

async function refresh() {
  error.value = "";
  loading.value = true;
  try {
    saveAdminKey();
    events.value = await api.listEvents();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function createEvent() {
  error.value = "";
  loading.value = true;
  try {
    saveAdminKey();
    await api.createEvent({
      title: form.value.title,
      joinMode: form.value.joinMode,
      accessCode: form.value.accessCode || null,
    });
    await refresh();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(refresh);
</script>

<template>
  <section class="stack">
    <FullScreenLoading v-if="loading" text="正在加载管理数据…" />
    <div class="card">
      <h2>管理端</h2>
      <div class="row">
        <label>Admin Key</label>
        <input v-model="adminKey" @change="saveAdminKey" placeholder="x-admin-key" />
        <button @click="refresh" :disabled="loading">刷新</button>
      </div>
      <p class="muted">后端用 header <code>x-admin-key</code> 做最简单鉴权（默认 dev-admin）。</p>
      <p class="muted">
        快捷入口：
        <a href="/admin/rooms">朋友圈红包管理</a>
      </p>
    </div>

    <div class="card">
      <h3>创建活动</h3>
      <div class="row">
        <label>标题</label>
        <input v-model="form.title" />
      </div>
      <div class="row">
        <label>参与模式</label>
        <select v-model="form.joinMode">
          <option value="BOTH">BOTH（导入 + 报名）</option>
          <option value="IMPORT_ONLY">IMPORT_ONLY（仅导入）</option>
          <option value="OPEN_SIGNUP">OPEN_SIGNUP（仅报名）</option>
        </select>
      </div>
      <div class="row">
        <label>报名口令（可选）</label>
        <input v-model="form.accessCode" />
      </div>
      <button @click="createEvent" :disabled="loading">创建</button>
    </div>

    <div class="card">
      <h3>活动列表</h3>
      <div v-if="error" class="error">错误：{{ error }}</div>
      <div v-if="loading && events.length === 0" class="muted">加载中…</div>
      <ul class="list">
        <li v-for="e in events" :key="e.id">
          <div class="title">{{ e.title }} <span class="muted">({{ e.joinMode }})</span></div>
          <div class="links">
            <a :href="`/admin/events/${e.id}`">管理</a>
            <a :href="`/events/${e.id}/signup`">报名页</a>
            <a :href="`/events/${e.id}/results`">公开结果</a>
            <a :href="`/events/${e.id}/draw`">3D舞台</a>
          </div>
        </li>
      </ul>
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
.row {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}
.muted {
  opacity: 0.75;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.title {
  font-weight: 600;
}
.links {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}
.error {
  color: #ffb4b4;
  margin: 8px 0;
}
input,
select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.15);
  color: inherit;
}
button {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  white-space: nowrap; /* 移动端避免“刷新”被挤成竖排 */
  min-width: 64px;
}

@media (max-width: 640px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>


