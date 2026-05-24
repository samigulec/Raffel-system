type RedisOk<T> = { result: T };

const URL_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_KV_REST_API_URL",
  "KV_REST_API_URL",
  "STORAGE_KV_REST_API_URL",
  "STORAGE_REST_URL",
];

const TOKEN_KEYS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_KV_REST_API_TOKEN",
  "KV_REST_API_TOKEN",
  "STORAGE_KV_REST_API_TOKEN",
  "STORAGE_REST_TOKEN",
];

function firstDefined(names: string[]): { name: string; value: string } | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.length > 0) return { name, value };
  }
  return null;
}

function getCreds() {
  const url = firstDefined(URL_KEYS);
  const token = firstDefined(TOKEN_KEYS);
  if (!url || !token) return null;
  return {
    url: url.value.replace(/\/$/, ""),
    token: token.value,
    urlVar: url.name,
    tokenVar: token.name,
  };
}

export function isRedisConfigured() {
  return getCreds() !== null;
}

export function redisDiagnostics() {
  const seenUrl = URL_KEYS.filter((k) => !!process.env[k]);
  const seenToken = TOKEN_KEYS.filter((k) => !!process.env[k]);
  const creds = getCreds();
  return {
    configured: creds !== null,
    selectedUrlVar: creds?.urlVar ?? null,
    selectedTokenVar: creds?.tokenVar ?? null,
    urlVarsPresent: seenUrl,
    tokenVarsPresent: seenToken,
  };
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
