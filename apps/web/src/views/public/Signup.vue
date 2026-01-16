<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";

const route = useRoute();
const eventId = computed(() => String(route.params.eventId || ""));

const eventInfo = ref<any>(null);
const form = ref({ displayName: "", accessCode: "" });
const ok = ref<any>(null);
const error = ref("");
const loading = ref(false);

const errorText = computed(() => {
  if (!error.value) return "";
  switch (error.value) {
    case "signup_disabled":
      return "该活动未开启报名（joinMode=IMPORT_ONLY）。请联系管理员把参与模式改成 BOTH / OPEN_SIGNUP。";
    case "accessCode_invalid":
      return "口令不正确。";
    case "displayName_required":
      return "请填写昵称。";
    case "displayName_too_long":
      return "昵称太长了（最多 40 字）。";
    case "not_found":
      return "活动不存在或已删除。";
    default:
      return `错误：${error.value}`;
  }
});

const signupEnabled = computed(() => {
  const jm = eventInfo.value?.joinMode;
  return jm === "OPEN_SIGNUP" || jm === "BOTH";
});

async function load() {
  error.value = "";
  try {
    eventInfo.value = await api.getEventPublic(eventId.value);
  } catch (e: any) {
    error.value = e?.message || String(e);
  }
}

async function submit() {
  error.value = "";
  ok.value = null;
  loading.value = true;
  try {
    ok.value = await api.signup(eventId.value, {
      displayName: form.value.displayName,
      accessCode: form.value.accessCode || undefined,
    });
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <FullScreenLoading v-if="loading" text="正在提交报名…" />
  <section class="card">
    <h2>报名：{{ eventInfo?.title || eventId }}</h2>
    <p class="muted">报名成功后可打开公开结果页查看是否中奖。</p>

    <div v-if="eventInfo" class="muted">当前参与模式：{{ eventInfo.joinMode }}</div>
    <div v-if="!signupEnabled && eventInfo" class="warn">该活动当前未开启报名（需要管理员开启）。</div>

    <div v-if="error" class="error">{{ errorText }}</div>
    <div v-if="ok" class="ok">报名成功：{{ ok.displayName }}</div>

    <div class="row">
      <label>昵称</label>
      <input v-model="form.displayName" placeholder="请输入昵称" />
    </div>
    <div class="row">
      <label>口令（可选）</label>
      <input v-model="form.accessCode" placeholder="如果活动设置了口令" />
    </div>

    <button @click="submit" :disabled="loading || !signupEnabled">提交</button>
    <div class="links">
      <a :href="`/events/${eventId}/results`">去看公开结果</a>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
}
.muted {
  opacity: 0.75;
}
.warn {
  color: #ffd38a;
  margin: 8px 0;
}
.error {
  color: #ffb4b4;
  margin: 8px 0;
}
.ok {
  color: #b7ffcb;
  margin: 8px 0;
}
input {
  width: 100%;
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
}
.links {
  margin-top: 10px;
}
</style>


