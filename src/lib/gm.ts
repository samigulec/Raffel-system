import { type Address, type Hex, pad, getAddress, isHex } from "viem";
import { GM_CONTRACT } from "./config";

type ReadClient = {
  readContract: (args: unknown) => Promise<unknown>;
  getBlockNumber: () => Promise<bigint>;
  getLogs: (args: unknown) => Promise<Array<{ topics: (Hex | null)[]; data: Hex; transactionHash: Hex | null }>>;
  getTransactionReceipt: (args: { hash: Hex }) => Promise<{
    from: Address;
    to: Address | null;
    status: "success" | "reverted";
    transactionHash: Hex;
  }>;
};

export { GM_CONTRACT };

const VIEW_ABIS = [
  { name: "lastGm", out: "uint256" },
  { name: "lastGM", out: "uint256" },
  { name: "lastSaidGm", out: "uint256" },
  { name: "lastGmAt", out: "uint256" },
  { name: "lastGmTime", out: "uint256" },
  { name: "gmTime", out: "uint256" },
  { name: "userLastGm", out: "uint256" },
  { name: "streaks", out: "uint256" },
  { name: "gmStreaks", out: "uint256" },
  { name: "totalGms", out: "uint256" },
  { name: "gmCount", out: "uint256" },
  { name: "mintedAt", out: "uint256" },
  { name: "hasMinted", out: "bool" },
  { name: "hasSaidGm", out: "bool" },
  { name: "saidGm", out: "bool" },
  { name: "balanceOf", out: "uint256" },
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

export type GmCheck = {
  ok: boolean;
  method: string;
  detail?: string;
};

export async function checkGm(client: unknown, user: Address): Promise<GmCheck> {
  const c = client as ReadClient;
  const normalized = getAddress(user);

  for (const fn of VIEW_ABIS) {
    try {
      const result = (await c.readContract({
        address: GM_CONTRACT,
        abi: buildAbi(fn.name, fn.out),
        functionName: fn.name,
        args: [normalized],
      })) as bigint | boolean;

      if (typeof result === "bigint" && result > 0n) {
        return { ok: true, method: fn.name, detail: result.toString() };
      }
      if (typeof result === "boolean" && result) {
        return { ok: true, method: fn.name, detail: "true" };
      }
    } catch {
      // try the next signature
    }
  }

  const padded = pad(normalized, { size: 32 }).toLowerCase();
  const addrNoPrefix = normalized.slice(2).toLowerCase();

  try {
    const latest = await c.getBlockNumber();
    const span = 1_000_000n;
    const fromBlock = latest > span ? latest - span : 0n;

    const chunk = 4_999n;
    for (let end = latest; end >= fromBlock; ) {
      const start = end > chunk ? end - chunk : 0n;
      const logs = await c.getLogs({
        address: GM_CONTRACT,
        fromBlock: start < fromBlock ? fromBlock : start,
        toBlock: end,
      });
      const hit = logs.find((log) => {
        const inTopics = log.topics
          .slice(1)
          .some((t) => t && t.toLowerCase() === padded);
        if (inTopics) return true;
        // Non-indexed address parameters land in `data` 32-byte slots.
        const data = (log.data ?? "0x").toLowerCase();
        return data.includes(addrNoPrefix);
      });
      if (hit) {
        return { ok: true, method: "event-log", detail: hit.transactionHash ?? "" };
      }
      if (start === 0n) break;
      end = start - 1n;
    }
  } catch (err) {
    return { ok: false, method: "error", detail: (err as Error).message };
  }

  return { ok: false, method: "none" };
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
    return { ok: true, method: "tx-hash", detail: receipt.transactionHash };
  } catch (err) {
    return { ok: false, method: "tx-hash", detail: (err as Error).message };
  }
}
