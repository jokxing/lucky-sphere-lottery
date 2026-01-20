<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import FullScreenLoading from "../components/FullScreenLoading.vue";

const route = useRoute();
const router = useRouter();
const exampleEventId = computed(() => String(route.query.eventId || ""));

const loading = ref(false);
const error = ref("");
const apiBase = computed(() => String((import.meta as any).env?.VITE_API_BASE || "").trim());

async function bootstrapDemo() {
  error.value = "";
  loading.value = true;
  try {
    const r = await api.demoBootstrap();
    const id = r?.event?.id;
    if (!id) throw new Error("demo_bootstrap_failed");
    await router.push(`/events/${id}/draw`);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <FullScreenLoading v-if="loading" text="正在生成演示数据…" />
  <section class="card">
    <h2>这是一个“线上抽奖”MVP 骨架</h2>
    <p>支持两种参与者来源：导入名单（IMPORT）+ 开放报名（SIGNUP），并提供公开结果页。</p>

    <div class="tips">
      <div>本地开发：根目录执行 <code>pnpm install</code>，再执行 <code>pnpm dev</code></div>
      <div>后端默认端口：3001；前端通过 Vite proxy 直接请求 <code>/api</code></div>
      <div v-if="apiBase">当前线上 API_BASE：<code>{{ apiBase }}</code></div>
      <div v-else class="ui-hint ui-hint--warn">未配置 <code>VITE_API_BASE</code>：线上会请求同域 <code>/api</code>，在 Pages 上会出现 405/404。</div>
    </div>

    <div class="actions">
      <button v-if="import.meta.env.DEV" @click="bootstrapDemo" :disabled="loading">一键生成演示抽奖（写死导入+直接开奖）</button>
      <button @click="router.push('/rooms/new')" :disabled="loading">创建朋友圈红包（虚拟）</button>
      <button v-if="!import.meta.env.DEV" @click="router.push('/admin')" :disabled="loading">进入管理端（创建活动/抽奖）</button>
      <div v-if="error" class="error">错误：{{ error }}</div>
      <div v-if="import.meta.env.DEV" class="muted">会清空本地 SQLite 数据库并写入演示数据（仅开发环境可用）。</div>
      <div v-else class="ui-hint">线上站点默认不提供“一键生成演示数据”，请在管理端创建活动并进入 3D 舞台。</div>
    </div>

    <div v-if="exampleEventId">
      <p>你可以直接打开：</p>
      <ul>
        <li><a :href="`/events/${exampleEventId}/signup`">报名页</a></li>
        <li><a :href="`/events/${exampleEventId}/results`">公开结果页</a></li>
        <li><a :href="`/admin/events/${exampleEventId}`">管理端活动页</a></li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.tips {
  margin-top: 12px;
  opacity: 0.9;
  display: grid;
  gap: 6px;
}
.actions {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
}
button {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  width: fit-content;
}
code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 6px;
}
</style>


