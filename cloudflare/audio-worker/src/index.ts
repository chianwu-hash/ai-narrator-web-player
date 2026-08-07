const DEFAULT_MAX_RANGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_URL_TTL_SECONDS = 24 * 60 * 60;

type WorkerEnvironment = {
  AUDIO_SIGNING_SECRET: string;
  AUDIO_TOKEN_BROKER_URL: string;
  AUDIO_TOKEN_BROKER_SECRET: string;
  ALLOWED_ORIGINS?: string;
  AUDIO_MAX_RANGE_BYTES?: string;
  MAX_SIGNED_URL_TTL_SECONDS?: string;
};

type WorkerDependencies = {
  fetch: typeof fetch;
  getAccessToken: (env: WorkerEnvironment) => Promise<string>;
};

let tokenCache: { token: string; expiresAt: number } | undefined;

function base64UrlBytes(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function signaturePayload(fileId: string, expiresAt: number): string {
  return `v1\n${fileId}\n${expiresAt}`;
}

async function expectedSignature(fileId: string, expiresAt: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signaturePayload(fileId, expiresAt)));
  return base64UrlBytes(new Uint8Array(signature));
}

export async function verifyAudioSignature(
  fileId: string,
  expiresAt: number,
  signature: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxTtlSeconds = DEFAULT_MAX_URL_TTL_SECONDS,
): Promise<boolean> {
  if (!fileId || !signature || secret.length < 32 || !Number.isInteger(expiresAt)) return false;
  if (expiresAt <= nowSeconds || expiresAt > nowSeconds + maxTtlSeconds) return false;
  return safeEqual(signature, await expectedSignature(fileId, expiresAt, secret));
}

export function normalizeWorkerRange(range: string | null, maxBytes = DEFAULT_MAX_RANGE_BYTES): string | null {
  const safeMax = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.floor(maxBytes) : DEFAULT_MAX_RANGE_BYTES;
  if (!range) return `bytes=0-${safeMax - 1}`;
  if (range.includes(",")) return null;

  const ordinary = range.match(/^bytes=(\d+)-(\d*)$/i);
  if (ordinary) {
    const start = Number(ordinary[1]);
    const requestedEnd = ordinary[2] ? Number(ordinary[2]) : Number.POSITIVE_INFINITY;
    if (!Number.isSafeInteger(start) || start < 0 || requestedEnd < start) return null;
    return `bytes=${start}-${Math.min(requestedEnd, start + safeMax - 1)}`;
  }

  const suffix = range.match(/^bytes=-(\d+)$/i);
  if (suffix) {
    const requested = Number(suffix[1]);
    if (!Number.isSafeInteger(requested) || requested <= 0) return null;
    return `bytes=-${Math.min(requested, safeMax)}`;
  }
  return null;
}

function allowedOrigins(env: WorkerEnvironment): Set<string> {
  return new Set((env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(origin: string | null, env: WorkerEnvironment): Headers {
  const headers = new Headers({
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "Range",
    "access-control-expose-headers": "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
    "access-control-max-age": "86400",
    vary: "Origin",
  });
  if (origin && allowedOrigins(env).has(origin)) headers.set("access-control-allow-origin", origin);
  return headers;
}

function originAllowed(origin: string | null, env: WorkerEnvironment): boolean {
  return !origin || allowedOrigins(env).has(origin);
}

function tokenBrokerUrl(env: WorkerEnvironment): URL {
  const url = new URL(env.AUDIO_TOKEN_BROKER_URL);
  const localDevelopment = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(localDevelopment && url.protocol === "http:")) {
    throw new Error("AUDIO_TOKEN_BROKER_URL must use HTTPS");
  }
  return url;
}

export async function requestBrokerAccessToken(
  env: WorkerEnvironment,
  fetchImpl = fetch,
): Promise<{ token: string; expiresAt: number }> {
  if ((env.AUDIO_TOKEN_BROKER_SECRET?.length ?? 0) < 32) throw new Error("AUDIO_TOKEN_BROKER_SECRET is invalid");
  const response = await fetchImpl(tokenBrokerUrl(env), {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${env.AUDIO_TOKEN_BROKER_SECRET}`,
    },
  });
  if (!response.ok) throw new Error(`Audio token broker request failed (${response.status})`);
  const body = await response.json() as { accessToken?: string; expiresAt?: string };
  const expiresAt = Date.parse(body.expiresAt ?? "");
  if (!body.accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 60_000) {
    throw new Error("Audio token broker returned an invalid token");
  }
  return { token: body.accessToken, expiresAt };
}

async function googleAccessToken(env: WorkerEnvironment, fetchImpl = fetch, forceRefresh = false): Promise<string> {
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  tokenCache = await requestBrokerAccessToken(env, fetchImpl);
  return tokenCache.token;
}

function copyResponseHeaders(upstream: Response, origin: string | null, env: WorkerEnvironment): Headers {
  const headers = corsHeaders(origin, env);
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, no-store");
  headers.set("cross-origin-resource-policy", "cross-origin");
  headers.set("referrer-policy", "no-referrer");
  return headers;
}

export async function handleAudioRequest(
  request: Request,
  env: WorkerEnvironment,
  dependencies?: Partial<WorkerDependencies>,
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!originAllowed(origin, env)) return new Response("Forbidden origin", { status: 403, headers: corsHeaders(origin, env) });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD, OPTIONS" } });
  }

  const url = new URL(request.url);
  const pathMatch = url.pathname.match(/\/audio\/([^/]+)$/);
  if (!pathMatch) return new Response("Not found", { status: 404 });
  let fileId: string;
  try {
    fileId = decodeURIComponent(pathMatch[1]);
  } catch {
    return new Response("Invalid file id", { status: 400 });
  }
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";
  const configuredMaxTtl = Number(env.MAX_SIGNED_URL_TTL_SECONDS ?? DEFAULT_MAX_URL_TTL_SECONDS);
  const maxTtl = Number.isFinite(configuredMaxTtl) && configuredMaxTtl > 0
    ? Math.floor(configuredMaxTtl)
    : DEFAULT_MAX_URL_TTL_SECONDS;
  if (!await verifyAudioSignature(fileId, expiresAt, signature, env.AUDIO_SIGNING_SECRET ?? "", undefined, maxTtl)) {
    return new Response("Expired or invalid signature", { status: 403, headers: { "cache-control": "no-store" } });
  }

  const range = normalizeWorkerRange(request.headers.get("range"), Number(env.AUDIO_MAX_RANGE_BYTES ?? DEFAULT_MAX_RANGE_BYTES));
  if (!range) return new Response("Invalid or multiple Range", { status: 416, headers: { "accept-ranges": "bytes" } });

  const fetchImpl = dependencies?.fetch ?? fetch;
  const getAccessToken = dependencies?.getAccessToken ?? ((environment: WorkerEnvironment) => googleAccessToken(environment, fetchImpl));
  const token = await getAccessToken(env);
  const upstream = await fetchImpl(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}`, range } },
  );
  const headers = copyResponseHeaders(upstream, origin, env);
  if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
    upstream.body?.cancel().catch(() => {});
    return new Response("Drive temporarily unavailable", { status: upstream.status, headers });
  }
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

const audioWorker = {
  fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    return handleAudioRequest(request, env);
  },
};

export default audioWorker;
