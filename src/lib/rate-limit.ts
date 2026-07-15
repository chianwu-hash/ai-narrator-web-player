type Attempt = { count: number; resetAt: number; blockedUntil: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkLoginRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const entry = attempts.get(key);
  if (!entry || now >= entry.resetAt) {
    attempts.set(key, { count: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.blockedUntil > now) return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  return { allowed: true, retryAfter: 0 };
}

export function recordFailedLogin(key: string, now = Date.now()): void {
  const entry = attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = now + WINDOW_MS;
  attempts.set(key, entry);
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
