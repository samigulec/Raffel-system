type RedisOk<T> = { result: T };

function getCreds() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

export function isRedisConfigured() {
  return getCreds() !== null;
}

async function call<T>(parts: string[]): Promise<T> {
  const creds = getCreds();
  if (!creds) throw new Error("Redis not configured");
  const path = parts.map(encodeURIComponent).join("/");
  const res = await fetch(`${creds.url}/${path}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Redis ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as RedisOk<T>;
  return json.result;
}

export async function redisExists(key: string): Promise<boolean> {
  const r = await call<number>(["exists", key]);
  return r > 0;
}

export async function redisSetNx(key: string, value: string): Promise<boolean> {
  // SET key value NX — returns "OK" if set, null if it already existed.
  const r = await call<string | null>(["set", key, value, "nx"]);
  return r === "OK";
}
