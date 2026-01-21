<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { isHostedMode, isAdminMode } from "./lib/hosted";

const route = useRoute();
const isStage = computed(() => {
  if (route.path.endsWith("/draw")) return true;
  // /rooms/:roomId 作为沉浸式舞台页（移动端更需要全屏）
  return /^\/rooms\/[^/]+$/.test(route.path);
});

const hosted = computed(() => isHostedMode());
const adminMode = computed(() => isAdminMode());
</script>

<template>
  <div class="layout" :class="{ stage: isStage }">
    <header v-if="!isStage" class="topbar">
      <div class="brand">线上抽奖 · MVP</div>
      <nav class="nav">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink v-if="!hosted || adminMode" to="/admin">管理端</RouterLink>
        <RouterLink to="/rooms/new">朋友圈红包</RouterLink>
      </nav>
    </header>

    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  max-width: 980px;
  margin: 0 auto;
  padding: 16px;
}
.layout.stage {
  max-width: none;
  padding: 0;
  min-height: 100vh;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.brand {
  font-weight: 700;
}
.nav {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.nav a {
  white-space: nowrap; /* 顶部导航中文不换行 */
}
.main {
  padding-top: 16px;
}
.layout.stage .main {
  padding-top: 0;
  min-height: 100vh;
}
a {
  color: inherit;
  opacity: 0.9;
}
a.router-link-active {
  opacity: 1;
  text-decoration: underline;
}
</style>
