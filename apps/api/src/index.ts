import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "./admin.js";
import { newSeed, scoreFor } from "./draw.js";

const prisma = new PrismaClient();

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

app.get("/health", async () => ({ ok: true }));

// --------------------
// Demo (dev only)
// --------------------
app.post("/api/demo/bootstrap", async (req, reply) => {
  // 只用于本地演示：避免生产误用
  if (process.env.NODE_ENV === "production") {
    return reply.code(404).send({ error: "not_found" });
  }

  // 清库（按依赖顺序）
  await prisma.win.deleteMany();
  await prisma.draw.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.prize.deleteMany();
  await prisma.event.deleteMany();

  const event = await prisma.event.create({
    data: {
      title: "演示活动：春节抽奖",
      joinMode: "BOTH",
      accessCode: null,
      resultsPublic: true,
    },
    select: { id: true, title: true, joinMode: true, resultsPublic: true, createdAt: true },
  });

  const prizes = await prisma.prize.createManyAndReturn({
    data: [
      { eventId: event.id, name: "一等奖", winnersCount: 1, order: 1 },
      { eventId: event.id, name: "二等奖", winnersCount: 2, order: 2 },
    ],
    select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
  });

  const names = [
    "张三",
    "李四",
    "王五",
    "赵六",
    "钱七",
    "孙八",
    "周九",
    "吴十",
    "jokxing",
    "小明",
    "小红",
    "小刚",
  ];

  await prisma.participant.createMany({
    data: names.map((displayName) => ({
      eventId: event.id,
      displayName,
      source: "IMPORT" as const,
    })),
  });

  return {
    event: { ...event, createdAt: event.createdAt.toISOString() },
    prizes: prizes.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    participantsCount: names.length,
  };
});

app.get("/api/demo/events/:eventId/state", async (req, reply) => {
  if (process.env.NODE_ENV === "production") {
    return reply.code(404).send({ error: "not_found" });
  }
  const { eventId } = req.params as { eventId: string };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, joinMode: true, createdAt: true },
  });
  if (!event) return reply.code(404).send({ error: "not_found" });

  const [prizes, participants, wins] = await Promise.all([
    prisma.prize.findMany({
      where: { eventId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
    }),
    prisma.participant.findMany({
      where: { eventId, disabled: false },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, source: true, createdAt: true },
    }),
    prisma.win.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: { id: true, prizeId: true, participantId: true, createdAt: true },
    }),
  ]);

  return {
    event: { ...event, createdAt: event.createdAt.toISOString() },
    prizes: prizes.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    participants: participants.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    wins: wins.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })),
  };
});

app.post("/api/demo/events/:eventId/draw", async (req, reply) => {
  if (process.env.NODE_ENV === "production") {
    return reply.code(404).send({ error: "not_found" });
  }
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as { prizeId?: string; count?: number; seed?: string };

  const prizeId = String(body.prizeId || "");
  if (!prizeId) return reply.code(400).send({ error: "prizeId_required" });

  const prize = await prisma.prize.findUnique({ where: { id: prizeId }, select: { id: true, eventId: true, winnersCount: true } });
  if (!prize || prize.eventId !== eventId) return reply.code(404).send({ error: "prize_not_found" });

  const count = Number.isFinite(body.count) ? Math.max(1, Math.floor(body.count!)) : prize.winnersCount;
  const seed = String(body.seed || "").trim() || newSeed();

  const candidates = await prisma.participant.findMany({
    where: { eventId, disabled: false, wins: { none: { eventId } } },
    select: { id: true, displayName: true },
  });
  if (candidates.length === 0) return reply.code(400).send({ error: "no_candidates" });

  const picked = [...candidates]
    .map((p) => ({ ...p, score: scoreFor(seed, p.id) }))
    .sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0))
    .slice(0, Math.min(count, candidates.length));

  const result = await prisma.$transaction(async (tx) => {
    const draw = await tx.draw.create({
      data: { eventId, prizeId, count: picked.length, seed },
      select: { id: true, createdAt: true },
    });
    await Promise.all(
      picked.map((p) =>
        tx.win.create({
          data: { eventId, drawId: draw.id, prizeId, participantId: p.id },
          select: { id: true },
        }),
      ),
    );
    return draw;
  });

  return {
    drawId: result.id,
    seed,
    winners: picked.map((p) => ({ participantId: p.id, displayName: p.displayName })),
  };
});

// --------------------
// Rooms (public, friend circle)
// --------------------
function isSixDigitCode(code: string) {
  return /^[0-9]{6}$/.test(code);
}

function toCentsAmount(x: unknown) {
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function fromCents(cents: number) {
  return Math.round(cents) / 100;
}

function pickAmountCents(remainingAmountCents: number, remainingCount: number, minCents: number, maxCents?: number | null) {
  if (remainingCount <= 1) return remainingAmountCents;
  const minTotalLeft = minCents * (remainingCount - 1);
  const hardMax = remainingAmountCents - minTotalLeft;
  const mean2 = Math.floor((remainingAmountCents / remainingCount) * 2);
  const upper = Math.max(minCents, Math.min(hardMax, mean2, maxCents ?? hardMax));
  const lower = minCents;
  const r = lower + Math.floor(Math.random() * (upper - lower + 1));
  return Math.max(lower, Math.min(hardMax, r));
}

app.post("/api/public/rooms", async (req, reply) => {
  // 无登录建房（第一版）
  const body = (req.body || {}) as {
    title?: string;
    accessCode?: string;
    totalAmount?: number; // 元
    totalCount?: number;
    minAmount?: number; // 元
    maxAmount?: number | null; // 元
  };

  const title = String(body.title || "").trim() || "朋友圈红包";
  const accessCode = String(body.accessCode || "").trim();
  if (!isSixDigitCode(accessCode)) return reply.code(400).send({ error: "accessCode_invalid" });

  const totalAmountCents = toCentsAmount(body.totalAmount);
  if (totalAmountCents === null || totalAmountCents < 1) return reply.code(400).send({ error: "totalAmount_invalid" });

  const totalCount = Number.isFinite(body.totalCount) ? Math.max(1, Math.floor(body.totalCount!)) : 10;
  const minCents = toCentsAmount(body.minAmount ?? 0.01);
  if (minCents === null || minCents < 1) return reply.code(400).send({ error: "minAmount_invalid" });

  const maxCents = body.maxAmount === null || body.maxAmount === undefined ? null : toCentsAmount(body.maxAmount);
  if (maxCents !== null && (maxCents === null || maxCents < minCents)) return reply.code(400).send({ error: "maxAmount_invalid" });

  // 约束：至少能满足每份 >= min
  if (totalAmountCents < minCents * totalCount) return reply.code(400).send({ error: "amount_too_small" });

  const room = await prisma.room.create({
    data: {
      title,
      accessCode,
      totalAmountCents,
      remainingAmountCents: totalAmountCents,
      totalCount,
      remainingCount: totalCount,
      minCents,
      maxCents,
    },
    select: {
      id: true,
      title: true,
      totalAmountCents: true,
      remainingAmountCents: true,
      totalCount: true,
      remainingCount: true,
      createdAt: true,
    },
  });

  return {
    roomId: room.id,
    title: room.title,
    totalAmount: fromCents(room.totalAmountCents),
    remainingAmount: fromCents(room.remainingAmountCents),
    totalCount: room.totalCount,
    remainingCount: room.remainingCount,
    createdAt: room.createdAt.toISOString(),
  };
});

app.post("/api/public/rooms/:roomId/enter", async (req, reply) => {
  const { roomId } = req.params as { roomId: string };
  const body = (req.body || {}) as { accessCode?: string };
  const accessCode = String(body.accessCode || "").trim();
  if (!isSixDigitCode(accessCode)) return reply.code(400).send({ error: "accessCode_invalid" });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      title: true,
      accessCode: true,
      totalAmountCents: true,
      remainingAmountCents: true,
      totalCount: true,
      remainingCount: true,
      createdAt: true,
      closedAt: true,
    },
  });
  if (!room) return reply.code(404).send({ error: "not_found" });
  if (room.accessCode !== accessCode) return reply.code(403).send({ error: "accessCode_invalid" });
  if (room.closedAt) return reply.code(400).send({ error: "room_closed" });

  return {
    roomId: room.id,
    title: room.title,
    totalAmount: fromCents(room.totalAmountCents),
    remainingAmount: fromCents(room.remainingAmountCents),
    totalCount: room.totalCount,
    remainingCount: room.remainingCount,
    createdAt: room.createdAt.toISOString(),
  };
});

app.post("/api/public/rooms/:roomId/claim", async (req, reply) => {
  const { roomId } = req.params as { roomId: string };
  const body = (req.body || {}) as { accessCode?: string; deviceId?: string; name?: string };
  const accessCode = String(body.accessCode || "").trim();
  if (!isSixDigitCode(accessCode)) return reply.code(400).send({ error: "accessCode_invalid" });
  const deviceId = String(body.deviceId || "").trim();
  if (!deviceId) return reply.code(400).send({ error: "deviceId_required" });
  const name = String(body.name || "").trim();
  if (!name) return reply.code(400).send({ error: "name_required" });
  if (name.length > 20) return reply.code(400).send({ error: "name_too_long" });

  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        title: true,
        accessCode: true,
        remainingAmountCents: true,
        remainingCount: true,
        minCents: true,
        maxCents: true,
        closedAt: true,
      },
    });
    if (!room) return { error: "not_found" as const };
    if (room.accessCode !== accessCode) return { error: "accessCode_invalid" as const };
    if (room.closedAt) return { error: "room_closed" as const };
    if (room.remainingCount <= 0 || room.remainingAmountCents <= 0) return { error: "no_candidates" as const };

    const existed = await tx.roomClaim.findUnique({
      where: { roomId_deviceId: { roomId, deviceId } },
      select: { id: true, amountCents: true, name: true, createdAt: true },
    });
    if (existed) {
      return { error: "already_claimed" as const, existed };
    }

    const amountCents = pickAmountCents(room.remainingAmountCents, room.remainingCount, room.minCents, room.maxCents);

    const claim = await tx.roomClaim.create({
      data: { roomId, deviceId, name, amountCents },
      select: { id: true, amountCents: true, name: true, createdAt: true },
    });

    const updated = await tx.room.update({
      where: { id: roomId },
      data: {
        remainingAmountCents: room.remainingAmountCents - amountCents,
        remainingCount: room.remainingCount - 1,
      },
      select: { remainingAmountCents: true, remainingCount: true },
    });

    return { claim, updated };
  });

  if ("error" in result) {
    const e = result.error;
    if (e === "not_found") return reply.code(404).send({ error: e });
    if (e === "accessCode_invalid") return reply.code(403).send({ error: e });
    if (e === "room_closed") return reply.code(400).send({ error: e });
    if (e === "no_candidates") return reply.code(400).send({ error: e });
    if (e === "already_claimed") return reply.code(400).send({ error: e, amount: fromCents(result.existed.amountCents) });
    return reply.code(400).send({ error: "unknown" });
  }

  return {
    name: result.claim.name,
    amount: fromCents(result.claim.amountCents),
    remainingAmount: fromCents(result.updated.remainingAmountCents),
    remainingCount: result.updated.remainingCount,
    createdAt: result.claim.createdAt.toISOString(),
  };
});

app.post("/api/public/rooms/:roomId/board", async (req, reply) => {
  const { roomId } = req.params as { roomId: string };
  const body = (req.body || {}) as { accessCode?: string };
  const accessCode = String(body.accessCode || "").trim();
  if (!isSixDigitCode(accessCode)) return reply.code(400).send({ error: "accessCode_invalid" });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, accessCode: true, title: true, remainingAmountCents: true, remainingCount: true },
  });
  if (!room) return reply.code(404).send({ error: "not_found" });
  if (room.accessCode !== accessCode) return reply.code(403).send({ error: "accessCode_invalid" });

  const claims = await prisma.roomClaim.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    select: { name: true, amountCents: true, createdAt: true },
  });
  return {
    title: room.title,
    remainingAmount: fromCents(room.remainingAmountCents),
    remainingCount: room.remainingCount,
    claims: claims.map((c) => ({ name: c.name, amount: fromCents(c.amountCents), createdAt: c.createdAt.toISOString() })),
  };
});

// --------------------
// Public APIs
// --------------------
app.get("/api/public/events/:eventId", async (req, reply) => {
  const { eventId } = req.params as { eventId: string };
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, joinMode: true, resultsPublic: true, createdAt: true },
  });
  if (!event) return reply.code(404).send({ error: "not_found" });
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
  };
});

app.post("/api/public/events/:eventId/signup", async (req, reply) => {
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as { displayName?: string; accessCode?: string };

  const displayName = String(body.displayName || "").trim();
  if (!displayName) return reply.code(400).send({ error: "displayName_required" });
  if (displayName.length > 40) return reply.code(400).send({ error: "displayName_too_long" });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, joinMode: true, accessCode: true },
  });
  if (!event) return reply.code(404).send({ error: "not_found" });
  if (!(event.joinMode === "OPEN_SIGNUP" || event.joinMode === "BOTH")) {
    return reply.code(400).send({ error: "signup_disabled" });
  }
  if (event.accessCode) {
    const got = String(body.accessCode || "");
    if (got !== event.accessCode) return reply.code(403).send({ error: "accessCode_invalid" });
  }

  const participant = await prisma.participant.create({
    data: { eventId: event.id, displayName, source: "SIGNUP" },
    select: { id: true, displayName: true, createdAt: true },
  });
  return {
    ...participant,
    createdAt: participant.createdAt.toISOString(),
  };
});

app.get("/api/public/events/:eventId/results", async (req, reply) => {
  const { eventId } = req.params as { eventId: string };
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, resultsPublic: true } });
  if (!event) return reply.code(404).send({ error: "not_found" });
  if (!event.resultsPublic) {
    // 仅管理员可见：携带正确 x-admin-key 才允许查看
    if (!requireAdmin(req, reply)) return;
  }

  const prizes = await prisma.prize.findMany({
    where: { eventId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
  });

  const wins = await prisma.win.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prizeId: true,
      createdAt: true,
      participant: { select: { id: true, displayName: true } },
      draw: { select: { id: true, createdAt: true } },
    },
  });

  return {
    prizes: prizes.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    wins: wins.map((w) => ({
      id: w.id,
      prizeId: w.prizeId,
      drawId: w.draw.id,
      participantId: w.participant.id,
      displayName: w.participant.displayName,
      createdAt: w.createdAt.toISOString(),
    })),
  };
});

// --------------------
// Admin APIs (x-admin-key)
// --------------------
app.get("/api/admin/events", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, joinMode: true, createdAt: true },
  });
  return events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));
});

app.post("/api/admin/events", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const body = (req.body || {}) as {
    title?: string;
    joinMode?: "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH";
    accessCode?: string | null;
    resultsPublic?: boolean;
  };
  const title = String(body.title || "").trim();
  if (!title) return reply.code(400).send({ error: "title_required" });

  const joinMode = body.joinMode || "BOTH";
  const accessCode = body.accessCode ? String(body.accessCode) : null;
  const resultsPublic = body.resultsPublic === undefined ? true : !!body.resultsPublic;

  const event = await prisma.event.create({
    data: { title, joinMode, accessCode, resultsPublic },
    select: { id: true, title: true, joinMode: true, accessCode: true, resultsPublic: true, createdAt: true },
  });
  return { ...event, createdAt: event.createdAt.toISOString() };
});

app.patch("/api/admin/events/:eventId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as {
    title?: string;
    joinMode?: "IMPORT_ONLY" | "OPEN_SIGNUP" | "BOTH";
    accessCode?: string | null;
    resultsPublic?: boolean;
  };

  const exists = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!exists) return reply.code(404).send({ error: "not_found" });

  const data: { title?: string; joinMode?: any; accessCode?: string | null; resultsPublic?: boolean } = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return reply.code(400).send({ error: "title_required" });
    data.title = title;
  }
  if (body.joinMode !== undefined) {
    data.joinMode = body.joinMode;
  }
  if (body.accessCode !== undefined) {
    data.accessCode = body.accessCode ? String(body.accessCode) : null;
  }
  if (body.resultsPublic !== undefined) {
    data.resultsPublic = !!body.resultsPublic;
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    select: { id: true, title: true, joinMode: true, accessCode: true, resultsPublic: true, createdAt: true },
  });
  return { ...updated, createdAt: updated.createdAt.toISOString() };
});

app.post("/api/admin/events/:eventId/prizes", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as { name?: string; winnersCount?: number; order?: number };

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return reply.code(404).send({ error: "not_found" });

  const name = String(body.name || "").trim();
  if (!name) return reply.code(400).send({ error: "name_required" });
  const winnersCount = Number.isFinite(body.winnersCount) ? Math.max(1, Math.floor(body.winnersCount!)) : 1;
  const order = Number.isFinite(body.order) ? Math.floor(body.order!) : 0;

  const prize = await prisma.prize.create({
    data: { eventId, name, winnersCount, order },
    select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
  });
  return { ...prize, createdAt: prize.createdAt.toISOString() };
});

app.post("/api/admin/events/:eventId/participants/import", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as { participants?: Array<{ displayName?: string }> };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, joinMode: true },
  });
  if (!event) return reply.code(404).send({ error: "not_found" });
  if (!(event.joinMode === "IMPORT_ONLY" || event.joinMode === "BOTH")) {
    return reply.code(400).send({ error: "import_disabled" });
  }

  const rows = Array.isArray(body.participants) ? body.participants : [];
  const cleaned = rows
    .map((p) => String(p.displayName || "").trim())
    .filter((n) => n.length > 0)
    .slice(0, 5000);

  if (cleaned.length === 0) return reply.code(400).send({ error: "participants_empty" });

  const created = await prisma.participant.createMany({
    data: cleaned.map((displayName) => ({ eventId, displayName, source: "IMPORT" as const })),
  });

  return { created: created.count };
});

app.post("/api/admin/events/:eventId/draws", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };
  const body = (req.body || {}) as { prizeId?: string; count?: number; seed?: string };

  const prizeId = String(body.prizeId || "");
  if (!prizeId) return reply.code(400).send({ error: "prizeId_required" });

  const [event, prize] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { id: true } }),
    prisma.prize.findUnique({ where: { id: prizeId }, select: { id: true, eventId: true, winnersCount: true } }),
  ]);
  if (!event) return reply.code(404).send({ error: "event_not_found" });
  if (!prize || prize.eventId !== eventId) return reply.code(404).send({ error: "prize_not_found" });

  const count = Number.isFinite(body.count) ? Math.max(1, Math.floor(body.count!)) : prize.winnersCount;
  const seed = String(body.seed || "").trim() || newSeed();

  // eligible: 未禁用 + 未中奖
  const candidates = await prisma.participant.findMany({
    where: {
      eventId,
      disabled: false,
      wins: { none: { eventId } },
    },
    select: { id: true, displayName: true },
  });

  if (candidates.length === 0) return reply.code(400).send({ error: "no_candidates" });

  const picked = [...candidates]
    .map((p) => ({ ...p, score: scoreFor(seed, p.id) }))
    .sort((a, b) => (a.score < b.score ? -1 : a.score > b.score ? 1 : 0))
    .slice(0, Math.min(count, candidates.length));

  const result = await prisma.$transaction(async (tx) => {
    const draw = await tx.draw.create({
      data: { eventId, prizeId, count: picked.length, seed },
      select: { id: true, createdAt: true },
    });
    const wins = await Promise.all(
      picked.map((p) =>
        tx.win.create({
          data: { eventId, drawId: draw.id, prizeId, participantId: p.id },
          select: { id: true, participantId: true },
        }),
      ),
    );
    return { draw, wins };
  });

  return {
    drawId: result.draw.id,
    seed,
    winners: picked.map((p) => ({ participantId: p.id, displayName: p.displayName })),
  };
});

app.get("/api/admin/events/:eventId/state", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, joinMode: true, accessCode: true, resultsPublic: true, createdAt: true },
  });
  if (!event) return reply.code(404).send({ error: "not_found" });

  const [prizes, participants, wins, draws] = await Promise.all([
    prisma.prize.findMany({
      where: { eventId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
    }),
    prisma.participant.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: { id: true, displayName: true, source: true, disabled: true, createdAt: true },
    }),
    prisma.win.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        prizeId: true,
        participantId: true,
        createdAt: true,
        participant: { select: { displayName: true } },
      },
    }),
    prisma.draw.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: { id: true, prizeId: true, count: true, seed: true, createdAt: true },
    }),
  ]);

  const eligibleCount = participants.filter((p) => !p.disabled && !wins.some((w) => w.participantId === p.id)).length;

  return {
    event: { ...event, createdAt: event.createdAt.toISOString() },
    prizes: prizes.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    participants: participants.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    draws: draws.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })),
    wins: wins.map((w) => ({
      id: w.id,
      prizeId: w.prizeId,
      participantId: w.participantId,
      displayName: w.participant.displayName,
      createdAt: w.createdAt.toISOString(),
    })),
    eligibleCount,
  };
});

app.post("/api/admin/events/:eventId/reset", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId } = req.params as { eventId: string };
  const exists = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!exists) return reply.code(404).send({ error: "not_found" });

  // 重置抽奖：只清空 draws/wins，不动奖项/名单
  await prisma.$transaction(async (tx) => {
    await tx.win.deleteMany({ where: { eventId } });
    await tx.draw.deleteMany({ where: { eventId } });
  });
  return { ok: true };
});

app.patch("/api/admin/events/:eventId/prizes/:prizeId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId, prizeId } = req.params as { eventId: string; prizeId: string };
  const body = (req.body || {}) as Partial<{ name: string; winnersCount: number; order: number }>;

  const prize = await prisma.prize.findUnique({ where: { id: prizeId }, select: { id: true, eventId: true } });
  if (!prize || prize.eventId !== eventId) return reply.code(404).send({ error: "not_found" });

  const data: any = {};
  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return reply.code(400).send({ error: "name_required" });
    data.name = name;
  }
  if (body.winnersCount !== undefined) {
    const n = Number(body.winnersCount);
    if (!Number.isFinite(n) || n < 1) return reply.code(400).send({ error: "winnersCount_invalid" });
    data.winnersCount = Math.floor(n);
  }
  if (body.order !== undefined) {
    const n = Number(body.order);
    if (!Number.isFinite(n)) return reply.code(400).send({ error: "order_invalid" });
    data.order = Math.floor(n);
  }

  const updated = await prisma.prize.update({
    where: { id: prizeId },
    data,
    select: { id: true, name: true, winnersCount: true, order: true, createdAt: true },
  });
  return { ...updated, createdAt: updated.createdAt.toISOString() };
});

app.delete("/api/admin/events/:eventId/prizes/:prizeId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId, prizeId } = req.params as { eventId: string; prizeId: string };
  const prize = await prisma.prize.findUnique({ where: { id: prizeId }, select: { id: true, eventId: true } });
  if (!prize || prize.eventId !== eventId) return reply.code(404).send({ error: "not_found" });
  await prisma.prize.delete({ where: { id: prizeId } });
  return { ok: true };
});

app.patch("/api/admin/events/:eventId/participants/:participantId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId, participantId } = req.params as { eventId: string; participantId: string };
  const body = (req.body || {}) as Partial<{ displayName: string; disabled: boolean }>;

  const p = await prisma.participant.findUnique({ where: { id: participantId }, select: { id: true, eventId: true } });
  if (!p || p.eventId !== eventId) return reply.code(404).send({ error: "not_found" });

  const data: any = {};
  if (body.displayName !== undefined) {
    const n = String(body.displayName || "").trim();
    if (!n) return reply.code(400).send({ error: "displayName_required" });
    if (n.length > 40) return reply.code(400).send({ error: "displayName_too_long" });
    data.displayName = n;
  }
  if (body.disabled !== undefined) {
    data.disabled = !!body.disabled;
  }

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data,
    select: { id: true, displayName: true, disabled: true, source: true, createdAt: true },
  });
  return { ...updated, createdAt: updated.createdAt.toISOString() };
});

app.delete("/api/admin/events/:eventId/participants/:participantId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { eventId, participantId } = req.params as { eventId: string; participantId: string };
  const p = await prisma.participant.findUnique({ where: { id: participantId }, select: { id: true, eventId: true } });
  if (!p || p.eventId !== eventId) return reply.code(404).send({ error: "not_found" });
  await prisma.participant.delete({ where: { id: participantId } });
  return { ok: true };
});

// --------------------
// Admin Rooms (friend circle)
// --------------------
app.get("/api/admin/rooms", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      accessCode: true,
      totalAmountCents: true,
      remainingAmountCents: true,
      totalCount: true,
      remainingCount: true,
      createdAt: true,
      closedAt: true,
    },
  });
  return rooms.map((r) => ({
    roomId: r.id,
    title: r.title,
    accessCode: r.accessCode,
    totalAmount: fromCents(r.totalAmountCents),
    remainingAmount: fromCents(r.remainingAmountCents),
    totalCount: r.totalCount,
    remainingCount: r.remainingCount,
    createdAt: r.createdAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
  }));
});

app.get("/api/admin/rooms/:roomId", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { roomId } = req.params as { roomId: string };
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      title: true,
      accessCode: true,
      totalAmountCents: true,
      remainingAmountCents: true,
      totalCount: true,
      remainingCount: true,
      createdAt: true,
      closedAt: true,
    },
  });
  if (!room) return reply.code(404).send({ error: "not_found" });

  const claims = await prisma.roomClaim.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, amountCents: true, createdAt: true, deviceId: true },
  });

  const max = claims.reduce<{ name: string; amount: number } | null>((acc, c) => {
    const amt = fromCents(c.amountCents);
    if (!acc || amt > acc.amount) return { name: c.name, amount: amt };
    return acc;
  }, null);

  return {
    roomId: room.id,
    title: room.title,
    accessCode: room.accessCode,
    totalAmount: fromCents(room.totalAmountCents),
    remainingAmount: fromCents(room.remainingAmountCents),
    totalCount: room.totalCount,
    remainingCount: room.remainingCount,
    createdAt: room.createdAt.toISOString(),
    closedAt: room.closedAt ? room.closedAt.toISOString() : null,
    maxWinner: max,
    claims: claims.map((c) => ({
      id: c.id,
      name: c.name,
      amount: fromCents(c.amountCents),
      deviceId: c.deviceId,
      createdAt: c.createdAt.toISOString(),
    })),
  };
});

app.post("/api/admin/rooms/:roomId/close", async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const { roomId } = req.params as { roomId: string };

  const exists = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true, closedAt: true } });
  if (!exists) return reply.code(404).send({ error: "not_found" });
  if (exists.closedAt) {
    return { ok: true, closedAt: exists.closedAt.toISOString() };
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { closedAt: new Date() },
    select: { id: true, closedAt: true },
  });
  return { ok: true, closedAt: updated.closedAt!.toISOString() };
});

const port = Number(process.env.PORT || 3001);
await app.listen({ port, host: "0.0.0.0" });


