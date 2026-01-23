<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const form = ref({
  title: "朋友圈红包（虚拟）",
  accessCode: gen6(),
  totalAmount: 20, // 元
  totalCount: 10,
  minAmount: 0.01,
});

const creating = ref(false);
const created = ref<any>(null);
const error = ref("");

async function create() {
  error.value = "";
  creating.value = true;
  try {
    created.value = await api.createRoom({
      title: form.value.title,
      accessCode: form.value.accessCode,
      totalAmount: form.value.totalAmount,
      totalCount: form.value.totalCount,
      minAmount: form.value.minAmount,
      maxAmount: null,
    });
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <FullScreenLoading v-if="creating" text="正在创建房间…" />
  <section class="card">
    <div class="header">
      <div class="title">创建朋友圈红包 <span class="badge">虚拟</span></div>
      <div class="ui-hint">生成房间后，把“房间链接 + 6 位口令”发到群里即可。</div>
    </div>

    <div v-if="error" class="error">错误：{{ error }}</div>

    <div class="grid">
      <label>标题</label>
      <input v-model="form.title" />

      <label>6 位口令</label>
      <div class="row">
        <input v-model="form.accessCode" />
        <button class="ghost" @click="form.accessCode = gen6()">换一个</button>
      </div>

      <label>总金额（元）</label>
      <input v-model.number="form.totalAmount" type="number" min="0.01" step="0.01" />

      <label>总份数</label>
      <input v-model.number="form.totalCount" type="number" min="1" step="1" />

      <label>最小金额（元）</label>
      <input v-model.number="form.minAmount" type="number" min="0.01" step="0.01" />
    </div>

    <button class="primary" @click="create" :disabled="creating">创建房间</button>

    <div v-if="created" class="result">
      <div class="muted">房间已创建：</div>
      <div class="big">口令：{{ form.accessCode }}</div>
      <div class="muted">链接：</div>
      <a :href="`/rooms/${created.roomId}`">{{ `/rooms/${created.roomId}` }}</a>
      <div class="muted" style="margin-top: 8px">榜单：</div>
      <a :href="`/rooms/${created.roomId}/board`">{{ `/rooms/${created.roomId}/board` }}</a>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 18px;
  background: var(--cardBg);
  backdrop-filter: var(--cardBlur);
  box-shadow: var(--cardInset), var(--cardShadow);
  max-width: 920px; /* PC 端别铺满，比例更舒服 */
  margin: 36px auto 0; /* PC 端别太贴顶部 */
}
.header {
  display: grid;
  gap: 8px;
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
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
  margin: 8px 0;
}
.grid {
  display: grid;
  /* 关键：minmax(0, 1fr) 避免子元素(输入框)最小内容宽度导致溢出 */
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
input {
  width: 100%;
  box-sizing: border-box; /* 修复：width=100% + padding/border 导致溢出 */
  padding: 10px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
}
/* 修复：row 内 input + 右侧按钮时，input 需要允许收缩，否则会溢出卡片 */
.row input {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
}
.primary {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 211, 122, 0.35);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-weight: 900;
  white-space: nowrap;
}
.ghost {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
  white-space: nowrap; /* 移动端“换一个”不换行 */
  min-width: 84px;
}
.result {
  margin-top: 14px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.18);
}
.big {
  font-size: 20px;
  font-weight: 900;
  margin: 4px 0 8px;
}

@media (max-width: 640px) {
  /* 移动端：移除卡片容器（更沉浸、更像原生页面） */
  .card {
    margin: 0;
    max-width: none;
    border: 0;
    border-radius: 0;
    /* 但仍保留内容安全边距：别贴边 */
    padding: 14px 14px 18px;
    background: transparent;
    backdrop-filter: none;
    box-shadow: none;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
  }
  input {
    font-size: 16px;
  }
}
</style>


