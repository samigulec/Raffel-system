import { type Address, type Hex, pad, getAddress } from "viem";
import { GM_CONTRACT } from "./config";

type ReadClient = {
  readContract: (args: unknown) => Promise<unknown>;
  getBlockNumber: () => Promise<bigint>;
  getLogs: (args: unknown) => Promise<Array<{ topics: (Hex | null)[]; transactionHash: Hex | null }>>;
};

export { GM_CONTRACT };

const VIEW_ABIS = [
  { name: "lastGm", out: "uint256" },
  { name: "lastGM", out: "uint256" },
  { name: "lastSaidGm", out: "uint256" },
  { name: "mintedAt", out: "uint256" },
  { name: "hasMinted", out: "bool" },
  { name: "hasSaidGm", out: "bool" },
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

  const userTopic = pad(normalized, { size: 32 }).toLowerCase() as Hex;

  try {
    const latest = await c.getBlockNumber();
    const span = 200_000n;
    const fromBlock = latest > span ? latest - span : 0n;

    const chunk = 4_999n;
    for (let end = latest; end >= fromBlock; ) {
      const start = end > chunk ? end - chunk : 0n;
      const logs = await c.getLogs({
        address: GM_CONTRACT,
        fromBlock: start < fromBlock ? fromBlock : start,
        toBlock: end,
      });
      const hit = logs.find((log) =>
        log.topics.slice(1).some((t) => t && t.toLowerCase() === userTopic),
      );
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
