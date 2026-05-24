import { NextResponse } from "next/server";
import { redisDiagnostics } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  const res = NextResponse.json({
    ok: true,
    discordWebhookConfigured: !!process.env.DISCORD_WEBHOOK_URL,
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    redis: redisDiagnostics(),
  });
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}
