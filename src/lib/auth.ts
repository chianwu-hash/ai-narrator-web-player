import { cookies } from "next/headers";
export { createSessionToken, sessionMaxAge, sessionVersion, verifyAccessCode, verifySessionToken } from "./auth-core";
import { verifySessionToken } from "./auth-core";

export const SESSION_COOKIE = "ai_narrator_session";

export async function isRequestAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}
