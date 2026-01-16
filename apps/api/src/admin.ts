import type { FastifyReply, FastifyRequest } from "fastify";

export function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.ADMIN_KEY || "dev-admin";
  const got = String(req.headers["x-admin-key"] || "");
  if (!got || got !== expected) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}


