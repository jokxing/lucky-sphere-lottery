# lucky-sphere-lottery

春节/年会抽奖 + 朋友圈红包（虚拟）的 **Vue3 + Fastify + Prisma** 全栈项目，带 3D “Lucky Sphere” 开奖舞台。

适合春节/年会/群活动的线上抽奖骨架：**导入名单（IMPORT）** + **开放报名（SIGNUP）** 两种参与者来源可共存，并提供可配置的结果可见性（公开 / 仅管理员可见）。

## 在线体验 & 联系我

- **在线体验（前端）**：`https://4b6dd36c.lucky-sphere-lottery-aiw.pages.dev`
- **联系我（部署/支持/定制）**：`mailto:64809547@qq.com`

> Render 免费实例可能会休眠，第一次打开/进管理端可能需要 10～60 秒冷启动。

## 快速支持（69 起）

- **69（远程部署/排障支持）**：帮你把这套跑起来（Render + Pages）、配环境变量、把 AdminKey/结果可见性等设置走通。
- **199（当日交付：换皮/文案）**：加上基础版 + 改 Logo/标题/主题色/落地页文案，适合朋友圈传播。
- **699+（年会定制）**：加上标准版 + 大屏投屏/主持人流程优化/导入名单规则调整（按需求报价）。

## 截图

把截图放到 `docs/screenshots/`（见 `docs/screenshots/README.md` 的命名建议）。

![管理端首页（活动列表）](docs/screenshots/01-draw-stage.png)
![创建朋友圈红包（PC）](docs/screenshots/02-draw-stage.png)
![朋友圈红包：进入房间（口令）](docs/screenshots/03-draw-stage.png)
![朋友圈红包：开奖卡 + 彩纸](docs/screenshots/04-draw-stage.png)
![年会抽奖：3D 舞台（奖项选择）](docs/screenshots/05-draw-stage.png)

## 技术栈

- **包管理**：pnpm（workspace 单仓）
- **前端**：Vue 3 + Vite + TypeScript + Vue Router
- **后端**：Fastify + TypeScript
- **数据库**：SQLite + Prisma

## 功能

- **年会抽奖（管理端）**
  - 新建活动 / 导入名单 / 新增奖项 / 抽奖（不允许重复中奖）
  - 奖项编辑、名单禁用/删除、一键重置中奖
  - 结果页可设置：公开 / 仅管理员可见（`x-admin-key`）
- **朋友圈红包（虚拟）**
  - 6 位口令入房间
  - 开抽动效（3D 球加速 + 开奖卡 + 彩纸爆炸）
  - 榜单页（需口令）

## 本地启动

在根目录：

```bash
pnpm install
pnpm dev
```

- Web：`http://localhost:5173`
- API：`http://localhost:3001`

## 最快体验流程（3 分钟跑通）

1. 打开管理端：`http://localhost:5173/admin`
2. **Admin Key**：默认是 `dev-admin`（浏览器会存到 localStorage 并在请求头带 `x-admin-key`）
3. 创建活动后，进入活动管理页：
   - 新增奖项（拿到 prizeId）
   - 导入名单（每行一个昵称）
4. 打开报名页：`/events/:eventId/signup`（可让别人自助加入）
5. 执行抽奖：管理页填 prizeId，点击“抽！”
6. 打开公开结果页：`/events/:eventId/results`

### 朋友圈红包（最快传播）

1. 打开创建页：`http://localhost:5173/rooms/new`
2. 创建成功后，把 **参与页链接 + 6 位口令** 发到群里
3. 榜单页：`/rooms/:roomId/board`（同样需要口令）

## 免费部署（Render/Fly + Pages）

> 推荐形态：**前端静态站（Pages） + 后端 API（Render/Fly）**。  
> 你需要给前端配置一个环境变量 `VITE_API_BASE` 指向后端域名，否则前端默认请求同域 `/api`。

### A. 部署后端（Render）

1. 进入 Render 创建 **Web Service**，选择 GitHub 仓库：[`jokxing/lucky-sphere-lottery`](https://github.com/jokxing/lucky-sphere-lottery)
2. 设置：
   - **Root Directory**：留空（仓库根目录）
   - **Build Command**（推荐一条写完，避免工作目录/步骤顺序问题）：
     - `npm i -g pnpm && pnpm install --frozen-lockfile --prod=false && pnpm -C apps/api prisma:push && pnpm -C apps/api build`
   - **Start Command**：`pnpm -C apps/api start`
3. 环境变量（Render Dashboard → Environment）：
   - `ADMIN_KEY`：管理员口令（例如 `dev-admin`，建议改复杂）
   - `DATABASE_URL`：默认 SQLite（示例：`file:./prisma/dev.db`）
   - `NODE_ENV`：`production`
   - `PORT`：Render 会注入（无需手动填）

> 注意：SQLite 在部分免费平台可能不保证长期持久化；如果你要长期运营，建议后续迁移到 Postgres。
>
> 另外：如果你点 Deploy 时弹出 **Add Card / verify identity**，这是 Render 的账号风控/验证流程，并非你的命令或环境变量填错；不方便绑定的话，可以先看下面的 Fly.io 或换任意可用的 Node 托管/VPS。
>
> 如果你在 Logs 里看到 `prisma: not found`，通常是因为设置了 `NODE_ENV=production` 导致安装依赖时跳过了 devDependencies；把 Build Command 的安装改成 `pnpm install ... --prod=false` 即可。

### B. 部署后端（Fly.io）

思路同 Render：部署一个 Node 服务，设置环境变量 `ADMIN_KEY` / `DATABASE_URL`，并执行 `pnpm -C apps/api prisma:push` 初始化数据库结构。

### C. 部署前端（Cloudflare Pages / Vercel / Netlify）

1. 选择 GitHub 仓库：[`jokxing/lucky-sphere-lottery`](https://github.com/jokxing/lucky-sphere-lottery)
2. Build 设置：
   - **Build Command**：`pnpm install && pnpm -C apps/web build`
   - **Output Directory**：`apps/web/dist`
3. 环境变量（必填）：
   - `VITE_API_BASE`：后端地址，例如 `https://xxx.onrender.com`

部署完成后，访问前端域名即可（管理端 `/admin`，朋友圈红包 `/rooms/new`）。

## 规则说明

- **不允许重复中奖**：数据库层面约束（同一 event 下 participant 只能有一条中奖记录）。
- **可复现随机**：每次抽奖都有 seed（可手动填，也可后端生成）；同 seed + 参与者集合会得到确定结果。

## 开源与免责声明

本项目为演示/学习用途，真实公司抽奖建议补充：更强鉴权、审计日志、稳定部署与数据备份。


