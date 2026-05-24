import { type Address, type Hex, pad, getAddress, isHex } from "viem";
import { GM_CONTRACT } from "./config";

type ReadClient = {
  readContract: (args: unknown) => Promise<unknown>;
  getBlockNumber: () => Promise<bigint>;
  getBlock: (args: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>;
  getLogs: (args: unknown) => Promise<
    Array<{
      topics: (Hex | null)[];
      data: Hex;
      transactionHash: Hex | null;
      blockNumber: bigint;
    }>
  >;
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    from: Address;
    to: Address | null;
    status: "success" | "reverted";
    transactionHash: Hex;
    blockNumber: bigint;
  }>;
};

export { GM_CONTRACT };

// View functions that return a unix-second timestamp of the last gm.
const TIMESTAMP_VIEWS = [
  "lastGm",
  "lastGM",
  "lastSaidGm",
  "lastGmAt",
  "lastGmTime",
  "gmTime",
  "userLastGm",
  "mintedAt",
] as const;

function buildAbi(name: string, out: "uint256" | "bool") {
  return [
    {
      type: "function",
      name,
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: out }],
    },
  ] as const;
}

function todayStartUtcSec(): bigint {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return BigInt(Math.floor(d.getTime() / 1000));
}

export type GmCheck = {
  ok: boolean;
  method: string;
  detail?: string;
};

export async function checkGm(client: unknown, user: Address): Promise<GmCheck> {
  const c = client as ReadClient;
  const normalized = getAddress(user);
  const today = todayStartUtcSec();

  // 1) Try contract views that return a "last gm" unix timestamp.
  //    Accept only if the timestamp is in today's UTC window.
  for (const name of TIMESTAMP_VIEWS) {
    try {
      const result = (await c.readContract({
        address: GM_CONTRACT,
        abi: buildAbi(name, "uint256"),
        functionName: name,
        args: [normalized],
      })) as bigint;

      if (typeof result === "bigint" && result >= today) {
        return { ok: true, method: name, detail: result.toString() };
      }
    } catch {
      // function doesn't exist on this contract; try the next one
    }
  }

  // 2) Scan recent event logs for the user, then verify the block timestamp
  //    is in today's UTC window. ~2 days of Ethereum blocks (12s) ≈ 14_400.
  const padded = pad(normalized, { size: 32 }).toLowerCase();
  const addrNoPrefix = normalized.slice(2).toLowerCase();

  try {
    const latest = await c.getBlockNumber();
    const span = 14_400n;
    const fromBlock = latest > span ? latest - span : 0n;

    const chunk = 4_999n;
    for (let end = latest; end >= fromBlock; ) {
      const start = end > chunk ? end - chunk : 0n;
      const lo = start < fromBlock ? fromBlock : start;
      const logs = await c.getLogs({
        address: GM_CONTRACT,
        fromBlock: lo,
        toBlock: end,
      });

      for (const log of logs) {
        const inTopics = log.topics
          .slice(1)
          .some((t) => t && t.toLowerCase() === padded);
        const inData = (log.data ?? "0x").toLowerCase().includes(addrNoPrefix);
        if (!inTopics && !inData) continue;

        const block = await c.getBlock({ blockNumber: log.blockNumber });
        if (block.timestamp >= today) {
          return { ok: true, method: "event-log", detail: log.transactionHash ?? "" };
        }
        // older than today; keep scanning newer chunks (already on the way back)
      }

      if (start === 0n) break;
      end = start - 1n;
    }
  } catch (err) {
    return { ok: false, method: "error", detail: (err as Error).message };
  }

  return {
    ok: false,
    method: "none",
    detail: "No gm found from today (after 00:00 UTC). Send a fresh gm and retry.",
  };
}

export async function verifyByTxHash(
  client: unknown,
  user: Address,
  hash: string,
): Promise<GmCheck> {
  if (!isHex(hash) || hash.length !== 66) {
    return { ok: false, method: "tx-hash", detail: "Not a valid 0x-prefixed 32-byte tx hash." };
  }

  const c = client as ReadClient;
  const today = todayStartUtcSec();

  try {
    const receipt = await c.getTransactionReceipt({ hash: hash as Hex });
    if (receipt.status !== "success") {
      return { ok: false, method: "tx-hash", detail: "Transaction reverted." };
    }
    const to = receipt.to?.toLowerCase();
    const from = receipt.from.toLowerCase();
    if (to !== GM_CONTRACT.toLowerCase()) {
      return {
        ok: false,
        method: "tx-hash",
        detail: `Tx target ${receipt.to ?? "(none)"} is not the gm contract.`,
      };
    }
    if (from !== user.toLowerCase()) {
      return {
        ok: false,
        method: "tx-hash",
        detail: `Tx sender ${receipt.from} is not the connected wallet.`,
      };
    }

    const block = await c.getBlock({ blockNumber: receipt.blockNumber });
    if (block.timestamp < today) {
      const sent = new Date(Number(block.timestamp) * 1000).toISOString();
      return {
        ok: false,
        method: "tx-hash",
        detail: `Tx is from ${sent}, before today 00:00 UTC. Send a fresh gm today.`,
      };
    }

    return { ok: true, method: "tx-hash", detail: receipt.transactionHash };
  } catch (err) {
    return { ok: false, method: "tx-hash", detail: (err as Error).message };
  }
}
