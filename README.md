# Raffel — 4-step verification system

A Next.js single-page replica of the "Complete all 4 steps" Faucet Badge UI.
Steps 1–3 are link-launchers; step 4 checks on-chain that the connected wallet
has interacted with the OnChainGM Faucet Badge contract on Base.

- gm contract: `0xcd21a60fb9f981dc1274f15ecaa250941edabd4e` (Base mainnet)
- A wallet is approved only after `Check` confirms the gm interaction.

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
