import { cookies } from "next/headers";
export { adminAuthConfigured, adminSessionMaxAge, createAdminSessionToken, verifyAdminAccessCode, verifyAdminSessionToken } from "./admin-auth-core";
import { verifyAdminSessionToken } from "./admin-auth-core";

export const ADMIN_SESSION_COOKIE = "ai_narrator_admin_session";

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}
