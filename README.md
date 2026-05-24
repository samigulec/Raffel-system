# Raffel — 5-step verification system

A Next.js single-page replica of the "Complete all steps" UI.

Steps:
1. Follow **OnChainGM** on X
2. Follow **Blobsters** on X
3. Like the tweet
4. Comment on the tweet
5. Send **gm** on Ethereum mainnet

Steps 1–4 are link-launchers (auto-clear a few seconds after opening).
Step 5 verifies on-chain that the connected wallet interacted with the gm
contract `0xcd21a60fb9f981dc1274f15ecaa250941edabd4e` on **Ethereum
mainnet** — only verified wallets are approved.

After all 5 steps pass, the user enters their X handle, signs a short
ownership message with their wallet, and submits. The signature is
verified server-side and the entry is posted to a Discord channel via
webhook.

## Setup

1. Edit links in `src/lib/config.ts` (Blobsters handle, tweet URLs, gm dapp).
2. Create the Discord webhook: **Server Settings → Integrations →
   Webhooks → New Webhook → Copy URL**.
3. Copy `.env.example` to `.env.local` and paste the URL into
   `DISCORD_WEBHOOK_URL`. Restart `npm run dev` after changing env vars.
4. The webhook URL is read **only on the server** (`src/app/api/submit/route.ts`)
   and never shipped to the browser.

## Run

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How verification works

`src/lib/gm.ts` tries common view functions first
(`lastGm`, `lastGM`, `mintedAt`, `hasMinted`, `hasSaidGm`, `balanceOf`).
If none returns a positive value, it scans the contract's recent event logs
(last ~500K Base blocks, in ≤9 999 block chunks) for any topic equal to the
connected address. A match marks the gm step complete and progress is saved
per-wallet in `localStorage`.
