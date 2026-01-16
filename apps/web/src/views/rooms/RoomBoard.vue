<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ApiError, api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const route = useRoute();
const roomId = computed(() => String(route.params.roomId || ""));
const accessCode = ref(localStorage.getItem("ROOM_CODE_" + roomId.value) || "");

const board = ref<any>(null);
const error = ref("");
const loading = ref(false);

async function load() {
  error.value = "";
  loading.value = true;
  try {
    board.value = await api.roomBoard(roomId.value, { accessCode: accessCode.value.trim() });
  } catch (e: any) {
    if (e instanceof ApiError) {
      error.value = e.code;
    } else {
      error.value = e?.message || String(e);
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => roomId.value,
  () => {
    accessCode.value = localStorage.getItem("ROOM_CODE_" + roomId.value) || "";
    load();
  },
  { immediate: true },
);
</script>

<template>
  <FullScreenLoading v-if="loading && !board" text="正在加载榜单…" />
  <section class="card">
    <div class="header">
      <div class="title">榜单 <span class="badge">虚拟</span></div>
      <div class="muted">{{ board?.title || roomId }}</div>
    </div>
    <div class="row">
      <input v-model="accessCode" placeholder="6 位口令" />
      <button class="ghost" @click="load" :disabled="loading">刷新</button>
    </div>
    <div v-if="error" class="error">
      <template v-if="error === 'accessCode_invalid'">口令不正确。</template>
      <template v-else-if="error === 'not_found'">房间不存在。</template>
      <template v-else>错误：{{ error }}</template>
    </div>
    <div v-if="board" class="muted">剩余：{{ board.remainingAmount }} 元 / {{ board.remainingCount }} 份</div>
    <ul v-if="board" class="list">
      <li v-for="(c, idx) in board.claims" :key="idx">
        <div class="name">{{ c.name }}</div>
        <div class="amt">{{ c.amount.toFixed(2) }} 元</div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 18px;
  background: linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.16));
  backdrop-filter: blur(10px);
}
.header {
  display: grid;
  gap: 6px;
}
.title {
  font-size: 20px;
  font-weight: 1000;
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
.row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
input {
  flex: 1;
  padding: 10px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
}
.ghost {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
}
.muted {
  opacity: 0.75;
  margin-top: 8px;
}
.error {
  color: #ffb4b4;
  margin-top: 8px;
}
.list {
  list-style: none;
  padding: 0;
  margin: 10px 0 0;
  display: grid;
  gap: 8px;
}
li {
  display: flex;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 10px;
  padding: 10px 12px;
}
.name {
  font-weight: 800;
}
.amt {
  opacity: 0.9;
}

@media (max-width: 640px) {
  input {
    font-size: 16px;
  }
  .row {
    flex-direction: column;
    align-items: stretch;
  }
  .ghost {
    width: 100%;
  }
}
</style>


