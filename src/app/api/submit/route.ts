import { NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { buildSubmissionMessage, SIGNATURE_TTL_MS } from "@/lib/submission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

const verifyClient = createPublicClient({
  chain: mainnet,
  transport: http("https://eth.llamarpc.com"),
});

type Body = {
  wallet?: unknown;
  xUsername?: unknown;
  issuedAt?: unknown;
  signature?: unknown;
};

export async function POST(req: Request) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json(
      { ok: false, error: "Server is missing DISCORD_WEBHOOK_URL." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  const xUsername =
    typeof body.xUsername === "string" ? body.xUsername.replace(/^@/, "").trim() : "";
  const issuedAt = typeof body.issuedAt === "number" ? body.issuedAt : 0;
  const signature = typeof body.signature === "string" ? body.signature : "";

  if (!isAddress(wallet)) {
    return NextResponse.json({ ok: false, error: "Invalid wallet address." }, { status: 400 });
  }
  if (!HANDLE_RE.test(xUsername)) {
    return NextResponse.json({ ok: false, error: "Invalid X username." }, { status: 400 });
  }
  if (!issuedAt || Math.abs(Date.now() - issuedAt) > SIGNATURE_TTL_MS) {
    return NextResponse.json(
      { ok: false, error: "Signature expired. Try Submit again." },
      { status: 400 },
    );
  }
  if (!signature.startsWith("0x")) {
    return NextResponse.json({ ok: false, error: "Missing signature." }, { status: 400 });
  }

  const normalized = getAddress(wallet);
  const message = buildSubmissionMessage({ wallet: normalized, xUsername, issuedAt });

  let valid = false;
  try {
    valid = await verifyClient.verifyMessage({
      address: normalized,
      message,
      signature: signature as `0x${string}`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Verify failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Signature does not match the wallet." },
      { status: 401 },
    );
  }

  const embed = {
    title: "New Raffel entry",
    color: 0x22d3ee,
    fields: [
      { name: "X", value: `@${xUsername}`, inline: true },
      {
        name: "Wallet",
        value: `[${normalized}](https://etherscan.io/address/${normalized})`,
        inline: false,
      },
    ],
    timestamp: new Date(issuedAt).toISOString(),
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Raffel",
        embeds: [embed],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `Discord rejected the webhook (${res.status}): ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Webhook request failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
