<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import * as THREE from "three";

type Person = { id: string; displayName: string };

const props = defineProps<{
  people: Person[];
  highlightIds: string[];
  running: boolean;
  focusId?: string;
  winnerName?: string;
  showWinnerCard?: boolean;
  confettiActive?: boolean;
}>();

const hostEl = ref<HTMLDivElement | null>(null);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let raf = 0;
let baseCameraZ = 7.25;
let lastAspect = 16 / 9;

let root: THREE.Group | null = null;
let cards: Array<{ id: string; mesh: THREE.Mesh; baseEmissive: THREE.Color }> = [];
let popId = "";
let popAnim = 0; // 0..1
// 之前用于“沿球面推出”的状态已移除（现在改为镜头中心 HUD 卡片）
let popCard: THREE.Mesh | null = null; // 镜头中心开奖卡片（复制中奖者贴图）
let popCardMat: THREE.MeshBasicMaterial | null = null;
let popCardTex: THREE.Texture | null = null;

let targetQuat: THREE.Quaternion | null = null;
let initialRootQuat: THREE.Quaternion | null = null;
let spinSpeed = 0.85; // radians/sec baseline（空闲慢转更有动感）

// 3D 彩纸：挂在 camera 上，位于中奖卡片背后，爆炸范围更大
let confettiGroup: THREE.Group | null = null;
type Confetti = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  vr: number;
  life: number;
  drag: number;
  phase: number;
};
let confettis: Confetti[] = [];

function seededUnit(seed: string) {
  // 简单稳定 hash -> [0,1)
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function makeCardTexture(name: string, key: string) {
  const w = 256;
  const h = 320;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  const isFiller = !String(name || "").trim();
  const u = seededUnit(key);

  // 背景：金红渐变（装饰卡会更克制一点）
  const g = ctx.createLinearGradient(0, 0, w, h);
  if (isFiller) {
    // 装饰卡：保持克制但仍是“红包红”，避免整屏发咖啡色
    g.addColorStop(0, "#3a0606"); // deep red base
    g.addColorStop(0.62, "#c2151e"); // saturated red
    g.addColorStop(0.86, "#ffd06a"); // small gold highlight
    g.addColorStop(1, "#8a0b14"); // back to deep red (avoid brown)
  } else {
    // 主卡：更偏红包红，金色只在角落做光感
    g.addColorStop(0, "#4a0707");
    g.addColorStop(0.58, "#e01625");
    g.addColorStop(0.86, "#ffd06a");
    g.addColorStop(1, "#9a0b14");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 降低噪点强度，避免“花”
  ctx.globalAlpha = isFiller ? 0.05 : 0.08;
  for (let i = 0; i < (isFiller ? 220 : 520); i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  ctx.globalAlpha = 1;

  // 卡片边框
  ctx.strokeStyle = "rgba(255, 215, 120, 0.9)";
  ctx.lineWidth = 6;
  roundRect(ctx, 10, 10, w - 20, h - 20, 22);
  ctx.stroke();

  // “福”印章（不抄任何 UI：做成抽象印章）
  ctx.save();
  ctx.translate(w - 70, 70);
  ctx.rotate(-0.25);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.strokeStyle = "rgba(255,215,120,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, -34, -34, 68, 68, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 215, 120, 0.85)";
  ctx.font = "bold 40px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("福", 0, 3);
  ctx.restore();

  if (isFiller) {
    // 装饰卡：中央做一个抽象徽记（不显示名字）
    ctx.save();
    ctx.translate(w / 2, 160);
    ctx.rotate((u - 0.5) * 0.35);
    ctx.strokeStyle = "rgba(255, 215, 120, 0.42)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 241, 194, 0.85)";
    ctx.font = "900 64px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("福", 0, 6);
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Lucky Sphere", w / 2, 266);
  } else {
    // 头像圈（首字母）
    const initial = (name || "?").trim().slice(0, 1);
    ctx.save();
    ctx.translate(w / 2, 118);
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 215, 120, 0.7)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "800 52px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial, 0, 2);
    ctx.restore();

    // 姓名
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(name, 10), w / 2, 230);

    // 小副标题（让卡片更“产品化”）
    ctx.fillStyle = "rgba(255,255,255,0.70)";
    ctx.font = "600 18px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Lucky Sphere", w / 2, 266);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(s: string, n: number) {
  const t = String(s || "").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function startConfettiBurst() {
  if (!confettiGroup) return;
  // 清理旧粒子
  for (const c of confettis) {
    c.mesh.removeFromParent();
    c.mesh.geometry.dispose();
    (c.mesh.material as THREE.Material).dispose();
  }
  confettis = [];

  const palette = ["#ffd37a", "#ff7a1a", "#b7ffcb", "#78b4ff", "#ff6b9a"];
  const isPortrait = lastAspect < 1;
  const N = 520; // 更大范围：数量更多
  for (let i = 0; i < N; i++) {
    const w = 0.05 + Math.random() * 0.12;
    const h = 0.05 + Math.random() * 0.16;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette[(Math.random() * palette.length) | 0]),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const m = new THREE.Mesh(geo, mat);
    // 从中奖卡片背后喷出：以 confettiGroup 原点为中心
    // 移动端：出生点更靠下，让“往上爆”的观感更明显
    // 同时移动端爆炸范围更收敛（你反馈：范围缩小一点）
    const px = (isPortrait ? -0.22 : -0.35) + Math.random() * (isPortrait ? 0.44 : 0.70);
    const py = isPortrait ? (-0.42 + Math.random() * 0.34) : (-0.30 + Math.random() * 0.60);
    const pz = -0.05 + Math.random() * 0.10;
    m.position.set(px, py, pz);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    // 确保彩纸在开奖卡片“上层”（前景）
    m.renderOrder = 1001; // popCard=999
    confettiGroup.add(m);

    // 更大的爆炸范围：速度更高，且带明显向外扩散
    const angle = Math.random() * Math.PI * 2;
    // 移动端：整体速度略收（范围更集中）
    const speed = (isPortrait ? 3.6 : 4.8) + Math.random() * (isPortrait ? 6.0 : 9.2);
    // 移动端：向上分量更强（“从卡片往上爆”）
    const up = isPortrait ? (5.2 + Math.random() * 4.6) : (2.2 + Math.random() * 3.4);
    // 前景彩纸：整体向镜头方向（z+）更明显
    const outZ = (isPortrait ? 0.18 : 0.25) + Math.random() * (isPortrait ? 0.72 : 1.15);
    confettis.push({
      mesh: m,
      vx: Math.cos(angle) * speed,
      // 保留一定左右扩散，但让整体更“上冲”
      vy: Math.sin(angle) * speed * (isPortrait ? 0.18 : 0.45) + up,
      vz: outZ,
      vr: (-4 + Math.random() * 8) * 2.2,
      life: 1.1 + Math.random() * 1.9,
      drag: 0.985 - Math.random() * 0.01,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function makeWinnerCardTexture(name: string) {
  const w = 768;
  const h = 960;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;

  // 背景：更红一点（避免发棕），金色只做角落高光
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#4a0707");
  g.addColorStop(0.58, "#e01625");
  g.addColorStop(0.86, "#ffd06a");
  g.addColorStop(1, "#9a0b14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 轻微噪点
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  ctx.globalAlpha = 1;

  // 边框
  ctx.strokeStyle = "rgba(255, 215, 120, 0.95)";
  ctx.lineWidth = 18;
  roundRect(ctx, 40, 40, w - 80, h - 80, 64);
  ctx.stroke();

  // 标题：恭喜中奖
  ctx.fillStyle = "rgba(255,241,194,0.98)";
  ctx.font = "900 64px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("恭喜中奖", w / 2, 140);

  // 福章
  ctx.save();
  ctx.translate(w - 190, 210);
  ctx.rotate(-0.25);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.strokeStyle = "rgba(255,215,120,0.60)";
  ctx.lineWidth = 10;
  roundRect(ctx, -90, -90, 180, 180, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 215, 120, 0.92)";
  ctx.font = "900 96px serif";
  ctx.fillText("福", 0, 10);
  ctx.restore();

  // 头像圈（首字母）
  const initial = (name || "?").trim().slice(0, 1);
  ctx.save();
  ctx.translate(w / 2, 420);
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 215, 120, 0.8)";
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.font = "950 140px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(initial, 0, 8);
  ctx.restore();

  // 姓名
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.font = "950 92px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(truncate(name, 12), w / 2, 660);

  // 底部小字
  ctx.fillStyle = "rgba(255,255,255,0.70)";
  ctx.font = "700 40px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Lucky Sphere", w / 2, 760);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function disposeScene() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  cards = [];
  root = null;
  popId = "";
  popAnim = 0;
  initialRootQuat = null;
  if (popCard) {
    popCard.removeFromParent();
    popCard.geometry.dispose();
  }
  if (popCardMat) {
    popCardMat.dispose();
  }
  popCard = null;
  popCardMat = null;
  if (popCardTex) popCardTex.dispose();
  popCardTex = null;

  if (confettiGroup) {
    confettiGroup.removeFromParent();
  }
  for (const c of confettis) {
    c.mesh.geometry.dispose();
    (c.mesh.material as THREE.Material).dispose();
  }
  confettis = [];
  confettiGroup = null;

  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  renderer = null;
  scene = null;
  camera = null;
}

function rebuild() {
  disposeScene();
  if (!hostEl.value) return;

  scene = new THREE.Scene();
  // 背景交给 CSS（暗角/舞台光），three 保持透明更舒服
  scene.background = null;
  scene.fog = new THREE.Fog("#0b0d12", 6.5, 13.5);

  const w = hostEl.value.clientWidth || 800;
  const h = hostEl.value.clientHeight || 520;

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  // 球稍微变大：相机拉近一点，填满上方留白，但不会压到按钮区（按钮区在 CSS 安全边距之外）
  baseCameraZ = 7.25;
  camera.position.set(0, 0, baseCameraZ);
  // 需要把 camera 加进 scene，才能渲染挂在 camera 上的 HUD（开奖卡片）
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  hostEl.value.appendChild(renderer.domElement);

  // 灯光：偏“舞台感”
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(3, 2, 4);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.42));

  root = new THREE.Group();
  scene.add(root);
  // 记录“初始化朝向”（回正用）
  initialRootQuat = root.quaternion.clone();
  // 球整体略放大 + 微下移：更饱满，但不压到底部按钮（由 CSS 的 bg3d bottom 控制安全区）
  root.scale.setScalar(1.18);
  root.position.y = -0.18;

  // confetti：在中奖卡片前景一点（更近），让彩纸“落在卡片上层”
  confettiGroup = new THREE.Group();
  confettiGroup.position.set(0, 0, -2.85);
  camera.add(confettiGroup);

  // 卡片分布：Fibonacci sphere
  const N = Math.max(1, props.people.length);
  const radius = 2.4;
  // 卡片缩小：减少相互穿插的概率（你反馈：不要交叉，可以叠）
  const cardW = 0.72;
  const cardH = 0.90;
  const planeGeo = new THREE.PlaneGeometry(cardW, cardH);
  // 关键：把卡片“压进球面”一点，避免边角凸出导致相互穿插出现不自然交叉
  // sagitta ≈ a^2 / (2r)，a 为半对角线长度
  const halfDiag = Math.hypot(cardW / 2, cardH / 2);
  const inset = ((halfDiag * halfDiag) / (2 * radius)) * 1.15;

  cards = props.people.map((p, i) => {
    const tex = makeCardTexture(p.displayName, p.id);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      // 默认不透明（你反馈：没开奖时不要透明）
      transparent: false,
      opacity: 1,
      color: new THREE.Color("#ffffff"),
      // 关键：关闭深度写入 + 后续按距离排序 renderOrder，让“重叠=盖住”而不是空间穿插
      depthWrite: false,
      depthTest: false,
      metalness: 0.15,
      roughness: 0.55,
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 0.0,
    });
    const mesh = new THREE.Mesh(planeGeo, mat);

    const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    mesh.position.set(
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.sin(theta) * Math.sin(phi),
      radius * Math.cos(phi),
    );
    // 法线（由中心指向卡片）
    const n = mesh.position.clone().normalize();
    // 切平面朝向：先看向中心（法线朝内），再翻转面向外侧
    mesh.lookAt(0, 0, 0);
    mesh.rotateY(Math.PI);
    // 压进球面，减少卡片边角凸出（从而减少“X形交叉”）
    mesh.position.addScaledVector(n, -inset);

    root!.add(mesh);
    return { id: p.id, mesh, baseEmissive: new THREE.Color("#000000") };
  });

  const clock = new THREE.Clock();
  const tmpCam = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();

  const onResize = () => {
    if (!hostEl.value || !renderer || !camera) return;
    const w2 = hostEl.value.clientWidth || 800;
    const h2 = hostEl.value.clientHeight || 520;
    camera.aspect = w2 / h2;
    lastAspect = camera.aspect;
    camera.updateProjectionMatrix();
    // 自适应：竖屏（w/h 小）时自动拉远镜头，避免球体被裁切、显得“太近”
    const aspect = w2 / h2;
    const factor = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    camera.position.z = baseCameraZ * factor;
    renderer.setSize(w2, h2);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(hostEl.value);

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (root) {
      // 运行中：快速旋转
      // 开奖定格中（targetQuat 存在）：暂停旋转，让 slerp 收敛到目标
      // 空闲：慢速旋转，保留“舞台感”
      const speed = props.running ? 3.4 : targetQuat || popAnim > 0.02 ? 0 : spinSpeed;
      if (speed !== 0) {
        root.rotation.y += dt * speed;
        root.rotation.x += dt * (speed * 0.15);
      }
    }

    // 开奖弹卡时：球体回到初始化“正”的朝向（而不是停在某个倾斜角）
    if (!props.running && props.showWinnerCard && initialRootQuat && root) {
      targetQuat = initialRootQuat;
    }

    // 停止时对准 focusId：插值到目标四元数
    if (!props.running && targetQuat && root) {
      root.quaternion.slerp(targetQuat, 1 - Math.pow(0.001, dt)); // 平滑收敛
      // 逼近后清空
      if (root.quaternion.angleTo(targetQuat) < 0.01) targetQuat = null;
    }

    // 高亮
    const set = new Set(props.highlightIds || []);
    for (const c of cards) {
      const mat = c.mesh.material as THREE.MeshStandardMaterial;
      const hit = set.has(c.id);
      mat.emissive = hit ? new THREE.Color("#fff1c2") : new THREE.Color("#000000");
      mat.emissiveIntensity = hit ? 0.75 : 0.0;
      // 不用透明做对比，改为“降饱和/压暗”来衬托中奖卡
      if (popAnim > 0.05) {
        mat.color = hit ? new THREE.Color("#ffffff") : new THREE.Color("#8a8f9a");
      } else {
        mat.color = new THREE.Color("#ffffff");
      }
      c.mesh.scale.setScalar(hit ? 1.08 : 1.0);
    }

    // 让“叠加”更自然：按与相机的距离排序 renderOrder（远的先画，近的后画）
    // 配合 depthWrite=false/depthTest=false，避免“穿插交叉”那种不自然线条。
    camera!.getWorldPosition(tmpCam);
    const sorted = cards
      .map((c) => {
        c.mesh.getWorldPosition(tmpPos);
        const d = tmpCam.distanceTo(tmpPos);
        return { c, d };
      })
      .sort((a, b) => b.d - a.d); // far -> near
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      if (!s) continue;
      s.c.mesh.renderOrder = i;
    }

    // 3D 彩纸爆炸：从中奖卡片背后喷出 + 重力落下（自然）
    if (confettis.length) {
      const g = -5.8;
      const time = performance.now() / 1000;
      for (let i = confettis.length - 1; i >= 0; i--) {
        const p = confettis[i]!;
        p.vy += g * dt;
        p.vx *= Math.pow(p.drag, dt * 60);
        p.vy *= Math.pow(p.drag, dt * 60);
        p.vz *= Math.pow(p.drag, dt * 60);
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        // 约束：保持在前景区域（更靠近镜头），避免彩纸跑到卡片背后
        if (p.mesh.position.z < -0.15) p.mesh.position.z = -0.15;
        if (p.mesh.position.z > 1.25) p.mesh.position.z = 1.25;

        p.mesh.rotation.z += p.vr * dt;
        p.mesh.rotation.x += (p.vr * 0.35) * dt;
        p.mesh.rotation.y += (p.vr * 0.22) * dt;
        // 翻面闪烁 + 淡出
        const flutter = 0.55 + 0.45 * Math.abs(Math.sin(time * 7 + p.phase));
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, Math.min(1, (p.life / 1.3) * flutter));
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.removeFromParent();
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          confettis.splice(i, 1);
        }
      }
    }

    // “中奖卡片弹出”：固定显示在镜头中心（带“恭喜中奖”文案）
    const wantPop = !!props.showWinnerCard && !!props.winnerName && !props.running;
    popAnim += ((wantPop ? 1 : 0) - popAnim) * (1 - Math.pow(0.001, dt));
    popAnim = Math.max(0, Math.min(1, popAnim));

    if (wantPop && props.winnerName) {
      // 重新创建/更新居中开奖卡贴图（包含“恭喜中奖”）
      if (!popCard) {
        popCardMat = new THREE.MeshBasicMaterial({
          map: null,
          transparent: true,
          opacity: 0,
          depthTest: false,
        });
        // 开奖卡在移动端容易显得“贴脸太大”，整体收一圈
        popCard = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.58), popCardMat);
        popCard.position.set(0, 0.02, -3.2);
        popCard.renderOrder = 999;
        camera!.add(popCard);
      }
      if (popId !== props.winnerName) {
        popId = props.winnerName;
        if (popCardTex) popCardTex.dispose();
        popCardTex = makeWinnerCardTexture(props.winnerName);
        popCardMat!.map = popCardTex;
        popCardMat!.needsUpdate = true;
      }
    }

    // 居中开奖卡片动画（淡入 + 放大 + 轻微弹性）
    if (popCard && popCardMat) {
      const t = popAnim;
      const easeOutBack = (x: number) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };
      const e = easeOutBack(t);
      popCardMat.opacity = 0.0 + 1.0 * t;
      const s = 0.78 + 0.18 * e;
      popCard.scale.setScalar(s);
      popCard.visible = t > 0.02;
    }

    renderer!.render(scene!, camera!);
  };
  tick();

  onBeforeUnmount(() => {
    ro.disconnect();
    disposeScene();
  });
}

function computeTargetQuat(focusId?: string) {
  if (!root || !focusId) return;
  const c = cards.find((x) => x.id === focusId);
  if (!c) return;

  // 目标：把该卡片的 position 转到“正前方”（相机方向 z+）
  // 当前点在 root 局部坐标，求让该向量对齐到 (0, 0, 1)
  const v = c.mesh.position.clone().normalize();
  const target = new THREE.Vector3(0, 0, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(v, target);

  // root 需要旋转 q 的逆（因为我们旋转 root，让点转到 target）
  // three.js 新版本使用 invert() 而不是 inverse()
  const inv = q.clone().invert();
  targetQuat = inv.multiply(root.quaternion.clone());
}

watch(
  () => props.people.map((p) => p.id).join(","),
  () => rebuild(),
);

watch(
  () => props.focusId,
  (id) => {
    try {
      // 开奖弹卡时我们选择“回正”，不再对准某个卡片
      if (!props.showWinnerCard) computeTargetQuat(id);
    } catch (e) {
      // 避免 3D 层异常影响 Vue 渲染树（控制台可见错误，但页面不崩）
      console.error("[ThreeLuckySphere] computeTargetQuat failed", e);
    }
  },
);

watch(
  () => props.confettiActive,
  (v) => {
    try {
      if (v) {
        // 让中奖卡先弹出一点点再爆炸更自然
        window.setTimeout(() => startConfettiBurst(), 120);
      }
    } catch (e) {
      console.error("[ThreeLuckySphere] confettiActive watch failed", e);
    }
  },
);

onMounted(() => rebuild());
</script>

<template>
  <div ref="hostEl" class="host">
    <div class="vignette" />
    <div class="grain" />
  </div>
</template>

<style scoped>
.host {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 0px;
  overflow: hidden;
  /* 更暗的舞台底色 + 更克制的暖色光晕 */
  background:
    radial-gradient(900px 520px at 35% 35%, rgba(255, 122, 26, 0.08), transparent 62%),
    radial-gradient(800px 520px at 70% 25%, rgba(255, 211, 122, 0.06), transparent 58%),
    radial-gradient(1000px 720px at 50% 75%, rgba(30, 42, 80, 0.10), transparent 60%),
    rgba(6, 8, 12, 0.92);
}
.vignette {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: radial-gradient(70% 70% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
}
.grain {
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.06;
  mix-blend-mode: overlay;
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 4px);
}
</style>


