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

After all 5 steps pass, the user enters their X handle and submits; the
entry (X username + wallet address) is stored locally per wallet.

Edit links in `src/lib/config.ts` (Blobsters handle, tweet URLs, etc).

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
