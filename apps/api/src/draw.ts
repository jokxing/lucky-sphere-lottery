import crypto from "node:crypto";

export function newSeed() {
  return crypto.randomBytes(16).toString("hex");
}

export function scoreFor(seed: string, participantId: string) {
  // Deterministic “random”：seed 固定时结果可复现
  return crypto.createHash("sha256").update(`${seed}:${participantId}`).digest("hex");
}


