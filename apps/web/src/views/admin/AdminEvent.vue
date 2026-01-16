<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../../lib/api";
import FullScreenLoading from "../../components/FullScreenLoading.vue";
import ConfirmDialog from "../../components/ConfirmDialog.vue";
import UiSelect from "../../components/UiSelect.vue";

const route = useRoute();
const eventId = computed(() => String(route.params.eventId || ""));

const eventInfo = ref<any>(null);
const state = ref<any>(null);
const error = ref("");
const loading = ref(false);

const eventSettings = ref({
  joinMode: "BOTH" as "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH",
  accessCode: "",
  resultsPublic: true,
});

const prizeForm = ref({ name: "一等奖", winnersCount: 1, order: 0 });
const importText = ref("张三\n李四\n王五");
const drawForm = ref({ prizeId: "", count: 1, seed: "" });

const confirmState = ref<{
  open: boolean;
  title: string;
  desc: string;
  danger?: boolean;
  confirmText?: string;
  onOk?: () => Promise<void> | void;
}>({ open: false, title: "", desc: "", danger: false });

const winnersByPrize = computed(() => {
  const ps = state.value?.prizes || [];
  const ws = state.value?.wins || [];
  return ps.map((p: any) => ({
    prizeId: p.id,
    prizeName: p.name,
    winners: ws.filter((w: any) => w.prizeId === p.id),
  }));
});

async function refreshAll() {
  error.value = "";
  loading.value = true;
  try {
    state.value = await api.adminEventState(eventId.value);
    eventInfo.value = state.value?.event;
    if (eventInfo.value?.joinMode) eventSettings.value.joinMode = eventInfo.value.joinMode;
    eventSettings.value.accessCode = eventInfo.value?.accessCode || "";
    eventSettings.value.resultsPublic = eventInfo.value?.resultsPublic !== false;
    // 默认选中第一个奖项，避免手填 prizeId
    if (!drawForm.value.prizeId && (state.value?.prizes || []).length) {
      drawForm.value.prizeId = state.value.prizes[0].id;
      drawForm.value.count = state.value.prizes[0].winnersCount || 1;
    }
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function saveEventSettings() {
  error.value = "";
  loading.value = true;
  try {
    await api.updateEvent(eventId.value, {
      joinMode: eventSettings.value.joinMode,
      accessCode: eventSettings.value.accessCode ? eventSettings.value.accessCode : null,
      resultsPublic: eventSettings.value.resultsPublic,
    });
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function createPrize() {
  error.value = "";
  loading.value = true;
  try {
    await api.createPrize(eventId.value, {
      name: prizeForm.value.name,
      winnersCount: prizeForm.value.winnersCount,
      order: prizeForm.value.order,
    });
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function importParticipants() {
  error.value = "";
  loading.value = true;
  try {
    const names = importText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    await api.importParticipants(eventId.value, names);
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function doDraw() {
  error.value = "";
  loading.value = true;
  try {
    await api.draw(eventId.value, {
      prizeId: drawForm.value.prizeId,
      count: drawForm.value.count,
      seed: drawForm.value.seed || undefined,
    });
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function resetDraws() {
  confirmState.value = {
    open: true,
    title: "重置抽奖？",
    desc: "将清空本活动的所有抽奖/中奖记录，但会保留奖项与名单。",
    danger: true,
    confirmText: "确定重置",
    onOk: async () => {
      error.value = "";
      loading.value = true;
      try {
        await api.adminResetEvent(eventId.value);
        drawForm.value.seed = "";
        await refreshAll();
      } catch (e: any) {
        error.value = e?.message || String(e);
      } finally {
        loading.value = false;
      }
    },
  };
}

async function toggleParticipant(p: any) {
  error.value = "";
  loading.value = true;
  try {
    await api.updateParticipant(eventId.value, p.id, { disabled: !p.disabled });
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function removeParticipant(p: any) {
  confirmState.value = {
    open: true,
    title: "删除名单？",
    desc: `确定删除名单「${p.displayName}」吗？如果该人已经中奖，对应中奖记录也会被级联删除。`,
    danger: true,
    confirmText: "确定删除",
    onOk: async () => {
      error.value = "";
      loading.value = true;
      try {
        await api.deleteParticipant(eventId.value, p.id);
        // 先本地移除，保证“删除立即可见”
        if (state.value?.participants) {
          state.value.participants = state.value.participants.filter((x: any) => x.id !== p.id);
        }
        await refreshAll();
      } catch (e: any) {
        error.value = e?.message || String(e);
      } finally {
        loading.value = false;
      }
    },
  };
}

async function savePrize(p: any) {
  error.value = "";
  loading.value = true;
  try {
    await api.updatePrize(eventId.value, p.id, { name: p.name, winnersCount: p.winnersCount, order: p.order });
    await refreshAll();
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function removePrize(p: any) {
  confirmState.value = {
    open: true,
    title: "删除奖项？",
    desc: `确定删除奖项「${p.name}」吗？会级联删除该奖项的抽奖/中奖记录。`,
    danger: true,
    confirmText: "确定删除",
    onOk: async () => {
      error.value = "";
      loading.value = true;
      try {
        await api.deletePrize(eventId.value, p.id);
        if (drawForm.value.prizeId === p.id) drawForm.value.prizeId = "";
        if (state.value?.prizes) {
          state.value.prizes = state.value.prizes.filter((x: any) => x.id !== p.id);
        }
        await refreshAll();
      } catch (e: any) {
        error.value = e?.message || String(e);
      } finally {
        loading.value = false;
      }
    },
  };
}

onMounted(refreshAll);
</script>

<template>
  <section class="stack">
    <FullScreenLoading v-if="loading" text="正在同步活动数据…" />
    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :description="confirmState.desc"
      :danger="confirmState.danger"
      :confirm-text="confirmState.confirmText || (confirmState.danger ? '确定' : '确定')"
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
      <h2>活动管理：{{ eventInfo?.title || eventId }}</h2>
      <div class="muted">joinMode：{{ eventInfo?.joinMode }}</div>
      <div class="muted">剩余可抽人数：{{ state?.eligibleCount ?? "-" }}</div>
      <div class="links">
        <a :href="`/events/${eventId}/signup`">报名页</a>
        <a :href="`/events/${eventId}/results`">公开结果</a>
      </div>
      <div class="actions">
        <button class="danger" @click="resetDraws" :disabled="loading">重置抽奖（清空中奖）</button>
      </div>
    </div>

    <div v-if="error" class="card error">错误：{{ error }}</div>

    <div class="card">
      <h3>活动设置（开启报名就在这里）</h3>
      <div class="row">
        <label>参与模式</label>
        <UiSelect
          v-model="eventSettings.joinMode"
          :options="[
            { value: 'BOTH', label: '导入 + 报名', desc: '既支持导入名单，也支持开放报名' },
            { value: 'IMPORT_ONLY', label: '仅导入名单', desc: '报名页不可用（适合公司固定名单）' },
            { value: 'OPEN_SIGNUP', label: '仅开放报名', desc: '所有人可报名加入（适合朋友圈/开放活动）' },
          ]"
        />
      </div>
      <div class="row">
        <label>报名口令（可选）</label>
        <input v-model="eventSettings.accessCode" placeholder="留空=不需要口令" />
      </div>
      <div class="row">
        <label>公开结果页</label>
        <UiSelect
          v-model="eventSettings.resultsPublic"
          :options="[
            { value: true, label: '公开', desc: '有链接即可查看中奖结果' },
            { value: false, label: '仅管理员可见', desc: '需要 x-admin-key（更适合公司抽奖）' },
          ]"
        />
      </div>
      <button @click="saveEventSettings" :disabled="loading">保存设置</button>
      <div class="ui-hint">如果报名页提示 signup_disabled，说明这里没开 OPEN_SIGNUP / BOTH。</div>
    </div>

    <div class="card">
      <h3>新增奖项</h3>
      <div class="row">
        <label>名称</label>
        <input v-model="prizeForm.name" />
      </div>
      <div class="row">
        <label>人数</label>
        <input v-model.number="prizeForm.winnersCount" type="number" min="1" />
      </div>
      <div class="row">
        <label>排序</label>
        <input v-model.number="prizeForm.order" type="number" />
      </div>
      <button @click="createPrize" :disabled="loading">创建奖项</button>
    </div>

    <div class="card">
      <h3>导入名单（每行一个）</h3>
      <textarea v-model="importText" rows="6" />
      <div class="actions">
        <button @click="importParticipants" :disabled="loading">导入</button>
      </div>
      <div class="ui-hint">提示：当前后端会把导入来源标记为 IMPORT；报名来源为 SIGNUP。</div>
    </div>

    <div class="card">
      <h3>执行抽奖</h3>
      <div class="row">
        <label>奖项</label>
        <select v-model="drawForm.prizeId">
          <option value="" disabled>请选择奖项</option>
          <option v-for="p in state?.prizes || []" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="row">
        <label>本轮人数</label>
        <input v-model.number="drawForm.count" type="number" min="1" />
      </div>
      <div class="row">
        <label>seed（可选）</label>
        <input v-model="drawForm.seed" placeholder="留空=后端生成" />
      </div>
      <button @click="doDraw" :disabled="loading">抽！</button>
      <div class="ui-hint">“不允许重复中奖”由后端数据库约束保证（同一活动 participant 只能有一条 win）。</div>
    </div>

    <div class="card">
      <h3>奖项 / 名单 / 结果</h3>
      <div v-if="loading && !state" class="muted">加载中…</div>
      <div v-if="state">
        <div class="muted">奖项（可直接编辑）：</div>
        <ul class="list">
          <li v-for="p in state.prizes" :key="p.id" class="item">
            <div class="row">
              <label>名称</label>
              <input v-model="p.name" />
            </div>
            <div class="row">
              <label>人数</label>
              <input v-model.number="p.winnersCount" type="number" min="1" />
            </div>
            <div class="row">
              <label>排序</label>
              <input v-model.number="p.order" type="number" />
            </div>
            <div class="actions">
              <button @click="savePrize(p)" :disabled="loading">保存</button>
              <button class="danger" @click="removePrize(p)" :disabled="loading">删除</button>
            </div>
          </li>
        </ul>

        <div class="muted" style="margin-top: 12px">名单（可禁用/移除）：</div>
        <ul class="list">
          <li v-for="p in state.participants" :key="p.id" class="item">
            <div class="pHead">
              <div class="pName">{{ p.displayName }}</div>
              <div class="pMeta">
                <span class="pill" :class="{ off: p.disabled }">{{ p.disabled ? "已禁用" : "启用" }}</span>
                <span class="sourceTag">{{ p.source }}</span>
              </div>
            </div>
            <div class="actions">
              <button @click="toggleParticipant(p)" :disabled="loading">{{ p.disabled ? "启用" : "禁用" }}</button>
              <button class="danger" @click="removeParticipant(p)" :disabled="loading">移除</button>
            </div>
          </li>
        </ul>

        <div class="muted" style="margin-top: 12px">中奖结果（按奖项分组）：</div>
        <div class="group" v-for="g in winnersByPrize" :key="g.prizeId">
          <div class="groupTitle">{{ g.prizeName }}</div>
          <ul class="list">
            <li v-for="w in g.winners" :key="w.id">
              <div class="title">{{ w.displayName }}</div>
            </li>
            <li v-if="g.winners.length === 0" class="muted">暂无</li>
          </ul>
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
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
  align-items: center;
  margin: 8px 0;
}
.links {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.muted {
  opacity: 0.75;
}
.error {
  color: #ffb4b4;
}
.list {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 8px;
}
.item {
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 10px;
  padding: 10px;
  background: rgba(0,0,0,0.12);
}
.actions {
  margin-top: 8px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.pHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.pName {
  font-weight: 900;
  letter-spacing: 0.2px;
}
.pMeta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}
.pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 211, 122, 0.25);
  background: rgba(255, 122, 26, 0.12);
  color: rgba(255, 241, 194, 0.95);
}
.pill.off {
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.78);
}
.sourceTag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.16);
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 0.3px;
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
.title {
  font-weight: 600;
}
input,
textarea {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.15);
  color: inherit;
}
select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.15);
  color: inherit;
}
.actions {
  margin-top: 8px;
}
button {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
}
.danger {
  border-color: rgba(255, 180, 180, 0.25);
  background: rgba(255, 0, 0, 0.08);
}
</style>


