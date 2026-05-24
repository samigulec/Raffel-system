# Raffel System

Next.js tabanlı, **5 adımlı raffle/giveaway başvuru** sistemi. Sosyal medya
adımları + on-chain `gm` doğrulamasıyla başvurular toplanır; doğrulanmış
girişler imzalı olarak Discord webhook'una gönderilir, aynı kişinin tekrar
girmesi Redis ile engellenir.

---

## İçindekiler

1. [Akış](#akış)
2. [Özet teknik yığın](#özet-teknik-yığın)
3. [Dosya yapısı](#dosya-yapısı)
4. [Lokal geliştirme](#lokal-geliştirme)
5. [Deploy mimarisi](#deploy-mimarisi)
6. [Ortam değişkenleri](#ortam-değişkenleri)
7. [Konfigürasyon — `src/lib/config.ts`](#konfigürasyon--srclibconfigts)
8. [gm doğrulama mantığı](#gm-doğrulama-mantığı)
9. [Günlük sıfırlama kuralı](#günlük-sıfırlama-kuralı)
10. [Dedup (tekrar başvuru engelleme)](#dedup-tekrar-başvuru-engelleme)
11. [Discord webhook ve imza doğrulama](#discord-webhook-ve-imza-doğrulama)
12. [Health endpoint — `/api/health`](#health-endpoint--apihealth)
13. [Sık karşılaşılan sorunlar](#sık-karşılaşılan-sorunlar)
14. [Nasıl genişletilir / değiştirilir](#nasıl-genişletilir--değiştirilir)

---

## Akış

Kullanıcı siteye girer ve **5 adımı sırayla** tamamlar:

1. **Follow OnChainGM on X** — link açar, birkaç saniye sonra otomatik ✓
2. **Follow Blobsters on X** — link açar, otomatik ✓
3. **Like the tweet** — link açar, otomatik ✓
4. **Comment on the tweet** — link açar, otomatik ✓
5. **Send gm on Ethereum (today)** — cüzdan bağlanır, `CHECK` butonuna
   basılır → kontratta **bugün** gm atılmış mı kontrol edilir

5/5 olduğunda alttaki form aktive olur. Kullanıcı X kullanıcı adını girer
(cüzdan adresi otomatik dolu gelir), `Submit`'e basar. Cüzdan kısa bir
sahiplik mesajı imzalar (gas yok). Sunucu imzayı doğrular, dedup'ı kontrol
eder, sonra Discord kanalına embed mesaj olarak düşürür.

---

## Özet teknik yığın

| Katman | Teknoloji |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Diller | TypeScript, React 18 |
| Stil | Tailwind CSS |
| Cüzdan / on-chain | wagmi v2 + viem (Ethereum mainnet, `injected` connector) |
| State | React state + `localStorage` (cüzdan-başına ilerleme) |
| Dedup veritabanı | Upstash Redis (REST API, SDK yok) |
| Bildirim | Discord webhook (server-side `fetch`) |
| Hosting | Vercel (Hobby plan yeter) |

---

## Dosya yapısı

```
.
├── README.md                       # Bu dosya
├── package.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── .env.example                    # Ortam değişkenleri şablonu
├── .env.local                      # (gitignored) — gerçek değerler
└── src/
    ├── app/
    │   ├── layout.tsx              # Kök layout
    │   ├── providers.tsx           # WagmiProvider + QueryClient
    │   ├── page.tsx                # Anasayfa (navbar + StepsCard)
    │   ├── globals.css             # Tailwind + özel stiller
    │   └── api/
    │       ├── submit/route.ts     # POST /api/submit (imza + Discord + dedup)
    │       └── health/route.ts     # GET  /api/health (teşhis)
    ├── components/
    │   ├── ConnectButton.tsx       # Wallet connect/disconnect butonu
    │   ├── ExternalIcon.tsx        # SVG ikonlar
    │   └── StepsCard.tsx           # 5 adım UI + form (ana komponent)
    └── lib/
        ├── config.ts               # Tüm linkler + gm kontrat adresi
        ├── wagmi.ts                # Wagmi config (mainnet + fallback RPC'ler)
        ├── gm.ts                   # gm doğrulama (auto check + tx hash)
        ├── progress.ts             # localStorage ilerleme ve submission tipleri
        ├── submission.ts           # İmza mesaj formatı + TTL
        └── redis.ts                # Upstash REST wrapper
```

---

## Lokal geliştirme

```bash
# Bağımlılıklar
npm install

# Ortam değişkenlerini hazırla
cp .env.example .env.local
# .env.local'ı aç ve değerleri doldur (aşağıdaki bölüme bak)

# Dev server
npm run dev
# → http://localhost:3000
```

> Ortam değişkenleri **sadece sunucu başladığında** okunuyor. `.env.local`'ı
> her değiştirdiğinde dev server'ı durdurup tekrar başlat.

---

## Deploy mimarisi

Frontend statik olarak cPanel'e, API Vercel Functions'a deploy edilir.
İkisi de aynı repo'dan üretilir.

```
Statik frontend (out/)   ──►  cPanel (public_html)
                              ↓ fetch
API + dedup + Discord     ──►  Vercel (Functions)
                              ↓
                              Upstash Redis + Discord webhook
```

cPanel sadece HTML/CSS/JS serve eder. Bütün gizli işler (Discord webhook,
Redis token, imza doğrulama) Vercel tarafındadır. Frontend → API çağrısı
cross-origin olduğu için API tarafında CORS başlıkları gönderilir.

### 1) API'yi Vercel'e deploy et

1. Repo'yu GitHub'a push'la.
2. https://vercel.com → **Add New → Project** → repo'yu seç → Deploy.
3. **Settings → Environments** → Production + Preview için şu değişkenleri ekle:
   - `DISCORD_WEBHOOK_URL`
   - `CORS_ORIGIN` (cPanel'deki domain'in tam adresi, örn. `https://yourdomain.com`. Test sırasında `*` da bırakabilirsin ama yayında pin'le.)
4. **Storage → Marketplace → Upstash** → Redis seç → projeye bağla
   (Custom Prefix: `UPSTASH_REDIS`).
5. **Deployments → en üstteki → ⋯ → Redeploy**.
6. Vercel sana bir URL verir, örn. `https://raffel-xyz.vercel.app`.
   `https://.../api/health` adresini ziyaret edip konfigürasyonu doğrula.

### 2) Statik frontend'i build'le

Proje kökündeki `.env.local`'a Vercel API URL'ini ekle:

```
NEXT_PUBLIC_API_BASE_URL=https://raffel-xyz.vercel.app
```

Sonra:

```bash
npm install
npm run build:static
```

Komut sırasıyla:

1. `src/app/api/` klasörünü güvenli şekilde geçici olarak
   `_api.disabled` altına taşır (Next.js `output: 'export'` API
   route'larla aynı anda çalışmıyor).
2. `STATIC_EXPORT=1` ile `next build` çalıştırır.
3. `out/` klasörünü üretir ve `src/app/api/` klasörünü geri taşır.
4. Süreç yarıda kalsa bile (CTRL+C, hata) klasör otomatik restore edilir.

### 3) cPanel'e yükle

1. cPanel → **File Manager** → `public_html/`'i aç.
2. Eski dosyaları yedekle.
3. `out/` klasörünün **içeriğini** (klasörün kendisini değil)
   `public_html/` içine yükle.
4. Domain'i tarayıcıda aç. Submit'te tx Vercel API'sine gidip Discord'a düşmeli.

> Apache `.htaccess` ile özel rewrite gerektirmez; `trailingSlash: true`
> sayesinde her sayfa `index.html` üzerinden serve edilir.

---

## Ortam değişkenleri

Hepsi **server-side**. Tarayıcıya hiçbiri gönderilmez.

| Anahtar | Zorunlu | Açıklama |
|--------|---------|----------|
| `DISCORD_WEBHOOK_URL` | **Evet** | Submit'lerin düşeceği Discord kanalının webhook URL'i. Discord → Server Settings → Integrations → Webhooks → New Webhook → Copy URL. |
| `UPSTASH_REDIS_REST_URL` | Önerilen | Upstash Redis REST endpoint. Tanımsızsa dedup atlanır. |
| `UPSTASH_REDIS_REST_TOKEN` | Önerilen | Upstash Redis REST token. |
| `CORS_ORIGIN` | Önerilen | Vercel API'nin CORS izin verdiği origin. cPanel domain'in (örn. `https://yourdomain.com`). Tanımsızsa `*`. |
| `NEXT_PUBLIC_API_BASE_URL` | Statik build için zorunlu | `npm run build:static` çalıştırırken kullanılır. Frontend bu URL'e fetch atar. Örn. `https://raffel-xyz.vercel.app`. Trailing slash yok. |

**Alias desteği:** `src/lib/redis.ts` aşağıdaki isimleri de tanır
(Vercel Marketplace farklı prefix verirse otomatik bulur):

- `UPSTASH_REDIS_KV_REST_API_URL` / `UPSTASH_REDIS_KV_REST_API_TOKEN`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`
- `STORAGE_KV_REST_API_URL` / `STORAGE_KV_REST_API_TOKEN`
- `STORAGE_REST_URL` / `STORAGE_REST_TOKEN`

---

## Konfigürasyon — `src/lib/config.ts`

Tüm public linkler ve gm kontrat adresi **tek dosyada**. Düzenlemek için:

```ts
import { type Address } from "viem";

// Doğrulanacak on-chain gm kontratı (Ethereum mainnet)
export const GM_CONTRACT: Address = "0xcd21a60fb9f981dc1274f15ecaa250941edabd4e";

export const LINKS = {
  followOnchainGm: "https://x.com/onchaingm",
  followBlobsters: "https://x.com/blobsters",
  likeTweet:       "https://x.com/onchaingm/status/PLACEHOLDER_TWEET_ID",
  commentTweet:    "https://x.com/onchaingm/status/PLACEHOLDER_TWEET_ID",
  gmDapp:          "https://www.onchaingm.com/",
};
```

> `PLACEHOLDER_TWEET_ID`'leri gerçek tweet URL'leriyle değiştir.
> Blobsters için doğru X handle'ını da düzelt.

Kontratı/zinciri değiştirmek istersen ayrıca `src/lib/wagmi.ts` (chain) ve
`src/app/api/submit/route.ts` (verifyClient için aynı chain) dosyalarını da
güncelle.

---

## gm doğrulama mantığı

Tamamı `src/lib/gm.ts`. İki bağımsız yol var; biri başarısız olursa diğeri
devreye giriyor.

### 1) Otomatik kontrol — `checkGm(client, user)`

Sırayla **view fonksiyonlarını** denerek bir "son gm timestamp"i bulmaya
çalışır:

```
lastGm, lastGM, lastSaidGm, lastGmAt, lastGmTime, gmTime, userLastGm, mintedAt
```

Hangisi başarılı sonuç dönerse, dönen değer **bugünün UTC 00:00 saniye
timestamp'inden büyük veya eşit** olmalı. Aksi halde "bugünkü gm yok" sayar.

View fonksiyonu yoksa **event log taraması** devreye girer:
- Son ~14 400 blok (~2 gün) taranır
- Kontratın emit ettiği loglarda kullanıcının adresi `topics` veya `data`
  içinde aranır (indexed olmayan adresleri yakalamak için ikisi de)
- Eşleşen log'un block'unun `timestamp`'i alınır, bugün UTC içinde mi
  kontrol edilir

### 2) Tx hash fallback — `verifyByTxHash(client, user, hash)`

Auto-check bulamazsa, gm satırının altındaki kutuya tx hash yapıştırılır.
Sunucu/istemci `eth_getTransactionReceipt` ile şunları doğrular:

- `receipt.status === "success"` (revert değil)
- `receipt.to === GM_CONTRACT` (gerçekten gm kontratı)
- `receipt.from === bağlı cüzdan` (başkasının tx'i değil)
- `block.timestamp >= bugün UTC 00:00` (taze)

Dördü de tutarsa adım onaylanır.

### RPC

`src/lib/wagmi.ts` viem'in `fallback` transport'u ile şu RPC'leri sırayla
dener (biri rate-limit'lerse diğeri devreye girer):

```
https://eth.llamarpc.com
https://ethereum-rpc.publicnode.com
https://rpc.ankr.com/eth
https://cloudflare-eth.com
```

---

## Günlük sıfırlama kuralı

- gm doğrulaması yalnızca **bugün UTC 00:00'dan sonra** atılmış işlemleri
  kabul eder.
- Dünden kalan gm reddedilir — kullanıcıya net hata gösterilir
  (`"Tx is from <ISO timestamp>, before today 00:00 UTC. Send a fresh gm today."`).
- UI'da 5. adımın altyazısı: `"Send a fresh gm today — resets daily at 00:00 UTC"`.

**Saat dilimi:** Blockchain timestamp'leri UTC olduğu için UTC referans
alındı. Türkiye saatiyle UTC+3 fark var (yerelde sabah 03:00'te yeni gün
başlar). Yerel saate çevirmek için `src/lib/gm.ts` içindeki
`todayStartUtcSec()` fonksiyonunu düzenle:

```ts
function todayStartUtcSec(): bigint {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);             // ← şu an UTC midnight
  // Türkiye için örneğin:
  // d.setUTCHours(-3, 0, 0, 0);         // önceki gün 21:00 UTC = TR 00:00
  return BigInt(Math.floor(d.getTime() / 1000));
}
```

---

## Dedup (tekrar başvuru engelleme)

`/api/submit` her başarılı imza doğrulamasından sonra **Upstash Redis**'te
iki anahtarı **atomik olarak** kilitler:

```
raffel:submitted:wallet:<lowercased-address>
raffel:submitted:x:<lowercased-handle>
```

Redis komutu: `SET key value NX` — anahtar yoksa kurar (`"OK"` döner),
varsa hiçbir şey yapmaz (`null` döner). İkincisinin döndüğü durumda istek
**409 Conflict** ile reddedilir; Discord webhook'una bir şey gitmez.

Bu sayede:
- Aynı **cüzdan** ikinci kez submit edemez.
- Aynı **X kullanıcı adı** başka cüzdanla bile submit edemez.

> Redis env değişkenleri tanımsızsa dedup atlanır ve aynı kişi tekrar tekrar
> gönderebilir. Üretimde mutlaka set edilmiş olmalı; `/api/health` bunu
> teyit etmek için var.

### Redis'i sıfırlamak (yeni kampanya)

Upstash konsolundan veya CLI'dan ilgili anahtarları silmek yeter. Komut
örneği (Upstash REST):

```bash
# Tüm raffel:submitted:* anahtarlarını sil
curl -s "$UPSTASH_REDIS_REST_URL/scan/0/match/raffel:submitted:*/count/1000" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
# Çıkan listeyi DEL ile geç:
# curl -s "$UPSTASH_REDIS_REST_URL/del/<key1>/<key2>/..." -H "Authorization: Bearer $TOKEN"
```

Veya Upstash dashboard'unda **Data Browser** üzerinden tek tek silebilirsin.

---

## Discord webhook ve imza doğrulama

### Akış

```
Browser                              /api/submit (server)            Discord
   │                                       │                            │
   │ 1. cüzdanla mesajı imzala (eth_sign)  │                            │
   │ ─────────────────────────────────────►│                            │
   │ 2. POST { wallet, xUsername,          │                            │
   │           issuedAt, signature }       │                            │
   │ ─────────────────────────────────────►│                            │
   │                                       │ 3. mesajı yeniden inşa et  │
   │                                       │    imzayı doğrula          │
   │                                       │    (mainnet client)         │
   │                                       │ 4. Redis SETNX (dedup)     │
   │                                       │ 5. embed POST              │
   │                                       │ ──────────────────────────►│
   │ ◄──────────────────────────────────── │ 6. { ok: true }            │
```

### İmzalanan mesaj formatı — `src/lib/submission.ts`

```
Raffel entry signature
Wallet: 0xAbC...
X: @handle
Issued: 2024-05-24T11:23:45.000Z
```

`issuedAt`'in **10 dakikadan eski** olduğu istekler reddedilir
(replay attack koruması — `SIGNATURE_TTL_MS`).

### Doğrulama

Sunucu tarafında `publicClient.verifyMessage({...})` kullanılır.
Bu, hem EOA hem de **EIP-1271 smart account** imzalarını doğrular
(Safe, Argent, vb. de çalışır).

### Discord embed formatı

```json
{
  "username": "Raffel",
  "embeds": [{
    "title": "New Raffel entry",
    "color": 0x22d3ee,
    "fields": [
      { "name": "X", "value": "@handle", "inline": true },
      { "name": "Wallet", "value": "[0x...](https://etherscan.io/address/0x...)" }
    ],
    "timestamp": "2024-05-24T11:23:45.000Z"
  }]
}
```

Webhook URL **kesinlikle frontend'e koyulmamalı** — yalnızca server-side
`process.env.DISCORD_WEBHOOK_URL` üzerinden okunuyor.

---

## Health endpoint — `/api/health`

Deploy sonrası env değişkenlerinin doğru bağlandığını teyit etmek için:

```
GET https://your-site.vercel.app/api/health
```

Örnek cevap:

```json
{
  "ok": true,
  "discordWebhookConfigured": true,
  "redis": {
    "configured": true,
    "selectedUrlVar": "UPSTASH_REDIS_KV_REST_API_URL",
    "selectedTokenVar": "UPSTASH_REDIS_KV_REST_API_TOKEN",
    "urlVarsPresent": ["UPSTASH_REDIS_KV_REST_API_URL"],
    "tokenVarsPresent": ["UPSTASH_REDIS_KV_REST_API_TOKEN"]
  }
}
```

`configured: false` görürsen — Vercel'de değişkenler eklenmemiş ya da
deployment onları henüz almamış (yeni bir redeploy gerekir).

---

## Sık karşılaşılan sorunlar

| Hata mesajı | Sebep | Çözüm |
|------------|-------|-------|
| `Server is missing DISCORD_WEBHOOK_URL.` | Webhook env değişkeni yok ya da deploy'a henüz inject edilmemiş | Vercel → Environments → ekle → Redeploy |
| `Signature does not match the wallet.` | İmza eskidi veya farklı cüzdan kullanılıyor | Submit'e tekrar bas (yeni `issuedAt` üretir) |
| `Signature expired. Try Submit again.` | İmza 10 dakikadan eski | Submit'e tekrar bas |
| `This wallet has already submitted an entry.` | Dedup çalışıyor — beklenen davranış | Yeni cüzdanla dene; veya Redis'ten anahtarı sil |
| `@handle has already submitted an entry.` | Aynı X handle başka cüzdanla bile kullanılmış | Farklı handle ya da Redis'ten temizle |
| `No gm found from today (after 00:00 UTC).` | Bugün UTC içinde gm yok | Taze gm at; veya tx hash'i yapıştır |
| `Tx is from <date>, before today 00:00 UTC.` | Eski bir gm tx hash'i verildi | Bugün yeni bir gm at, onun hash'ini yapıştır |
| `Discord rejected the webhook (4xx)` | Webhook silinmiş / URL hatalı / oran limiti | Yeni webhook oluştur, env'i güncelle, redeploy |

---

## Nasıl genişletilir / değiştirilir

### Adım sayısını veya içeriklerini değiştirmek

`src/components/StepsCard.tsx` içindeki `STEPS` dizisi tek kaynak. Yeni
satır ekle:

```ts
const STEPS: Step[] = [
  { kind: "link", key: "followOnchainGm", label: "Follow ...", url: LINKS.x },
  // ekle:
  { kind: "link", key: "newStep", label: "...", url: "https://..." },
  // veya başka bir on-chain check:
  { kind: "check", key: "newCheck", label: "...", subtitle: "...", url: "..." },
];
```

`Progress` tipini (`src/lib/progress.ts`) ve `TOTAL_STEPS`'i de aynı anda
güncelle.

### Kontrat / zincir değiştirmek

1. `src/lib/config.ts` → `GM_CONTRACT` yeni adres
2. `src/lib/wagmi.ts` → `chains` ve `transports` yeni zincir
3. `src/app/api/submit/route.ts` → `verifyClient`'ı aynı zincire al
4. UI metinleri (`StepsCard.tsx`, `subtitle`, hata mesajları)
5. Etherscan/explorer linkleri (`route.ts` içinde `etherscan.io/address/...`)

### Discord embed formatını değiştirmek

`src/app/api/submit/route.ts` içinde `embed` nesnesi. Discord embed
referansı: <https://discord.com/developers/docs/resources/webhook>

### Kayıtları başka yere de göndermek (Google Sheets, Notion, vb.)

`/api/submit` route'unda Discord fetch'inden hemen önce/sonra ikinci bir
fetch çağrısı ekle. Aynı kalıp:

```ts
await fetch(process.env.SHEETS_WEBHOOK_URL!, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ wallet: normalized, xUsername, timestamp: issuedAt }),
});
```

Sonra Vercel'e `SHEETS_WEBHOOK_URL` env değişkenini ekle.

### Saat dilimini Türkiye saatine almak

Bkz. [Günlük sıfırlama kuralı](#günlük-sıfırlama-kuralı) bölümü.

### Birden fazla gm gününe izin vermek (örn. son 7 gün)

`src/lib/gm.ts` içindeki `todayStartUtcSec()` yerine:

```ts
function lastNDaysStartUtcSec(days: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) - days * 24 * 60 * 60);
}
```

ve `>= today` yerine `>= lastNDaysStartUtcSec(7)` kullan.

---

## Komutlar özet

```bash
npm install         # bağımlılıklar
npm run dev         # lokal dev (http://localhost:3000)
npm run build       # production build (Vercel bunu çalıştırıyor)
npm run start       # build sonrası lokal prod sunucu
npx tsc --noEmit    # tip kontrolü
```

---

## Güvenlik notları

- **Discord webhook URL'i** asla repo'ya, frontend'e veya log'a sızmamalı.
  Sızdıysa Discord'dan webhook'u silip yenisini oluştur.
- Submit endpoint'i imza doğrulama yapıyor — başkası, başka birinin cüzdan
  adresini yazıp giriş yapamaz. EIP-1271 destekli olduğu için smart account
  cüzdanları da çalışır.
- `issuedAt` 10 dakikalık TTL ile replay attack koruması sağlıyor.
- Dedup `SETNX` ile atomik — race condition yok.
- Public RPC'ler kullanıldığı için yüksek trafikte rate-limit yiyebilirsin.
  Üretim trafiği büyürse Alchemy/Infura key'i alıp `wagmi.ts`'ye ve
  `route.ts`'deki `verifyClient`'a koyman önerilir.
