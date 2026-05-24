import { NextResponse } from "next/server";
import { redisDiagnostics } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const webhookConfigured = !!process.env.DISCORD_WEBHOOK_URL;
  const redis = redisDiagnostics();
  return NextResponse.json({
    ok: true,
    discordWebhookConfigured: webhookConfigured,
    redis,
  });
}
