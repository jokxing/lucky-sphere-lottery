<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const route = useRoute();
const eventId = computed(() => String(route.params.eventId || ""));

const eventInfo = ref<any>(null);
const results = ref<any>(null);
const error = ref("");
const showDebug = ref(false);
const loading = ref(false);

const prizeNameById = computed(() => {
  const m = new Map<string, string>();
  const ps = results.value?.prizes || [];
  for (const p of ps) m.set(p.id, p.name);
  return m;
});

const winnersByPrize = computed(() => {
  const ps = results.value?.prizes || [];
  const ws = results.value?.wins || [];
  return ps.map((p: any) => ({
    prizeId: p.id,
    prizeName: p.name,
    winners: ws.filter((w: any) => w.prizeId === p.id),
  }));
});

async function load() {
  error.value = "";
  loading.value = true;
  try {
    eventInfo.value = await api.getEventPublic(eventId.value);
    results.value = await api.getResults(eventId.value);
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (msg === "unauthorized") {
      error.value = "仅管理员可见：请先在管理端设置 Admin Key（x-admin-key）后再访问结果页。";
    } else if (msg === "results_private") {
      error.value = "仅管理员可见：该活动已关闭公开结果页。";
    } else {
      error.value = msg;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <FullScreenLoading v-if="loading && !results" text="正在加载公开结果…" />
  <section class="card">
    <h2>公开结果：{{ eventInfo?.title || eventId }}</h2>
    <div v-if="error" class="error">错误：{{ error }}</div>

    <div v-if="results">
      <h3>奖项</h3>
      <ul class="list">
        <li v-for="p in results.prizes" :key="p.id">
          <div class="title">{{ p.name }}</div>
          <div class="muted">默认人数：{{ p.winnersCount }}</div>
        </li>
      </ul>

      <h3 style="margin-top: 12px">中奖结果</h3>
      <div class="group" v-for="g in winnersByPrize" :key="g.prizeId">
        <div class="groupTitle">{{ g.prizeName }}</div>
        <ul class="list">
          <li v-for="w in g.winners" :key="w.id">
            <div class="title">{{ w.displayName }}</div>
          </li>
          <li v-if="g.winners.length === 0" class="muted">暂无</li>
        </ul>
      </div>

      <button class="debugBtn" @click="showDebug = !showDebug">
        {{ showDebug ? "隐藏调试信息" : "显示调试信息" }}
      </button>
      <div v-if="showDebug" class="debug">
        <div class="muted">wins（含 prizeId）：</div>
        <ul class="list">
          <li v-for="w in results.wins" :key="w.id">
            <div class="title">{{ w.displayName }}</div>
            <div class="muted">奖项：{{ prizeNameById.get(w.prizeId) || w.prizeId }}</div>
          </li>
        </ul>
      </div>
    </div>

    <div class="links">
      <a :href="`/events/${eventId}/signup`">返回报名页</a>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 8px;
}
.title {
  font-weight: 600;
}
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
  margin: 8px 0;
}
.links {
  margin-top: 12px;
}
.group {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.12);
}
.groupTitle {
  font-weight: 700;
  margin-bottom: 6px;
}
.debugBtn {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
}
.debug {
  margin-top: 10px;
}
</style>


