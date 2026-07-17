import { type BookWishStatus, validateBookWish } from "./wish-model";

type WishRow = {
  id: string;
  title: string;
  author: string | null;
  reason: string;
  status: BookWishStatus;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const WISH_SELECT = "id,title,author,reason,status,created_at,updated_at,deleted_at";

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const url = `${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function publicWish(row: WishRow) {
  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
  };
}

export async function createBookWish(input: unknown) {
  const parsed = validateBookWish(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const rows = await supabaseFetch<WishRow[]>("book_wishes", {
    method: "POST",
    body: JSON.stringify({
      title: parsed.value.title,
      author: parsed.value.author ?? null,
      reason: parsed.value.reason,
      status: "new",
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("No wish returned from Supabase");
  return publicWish(row);
}

export async function listAdminBookWishes(statusInput: unknown = "new") {
  const status = typeof statusInput === "string" ? statusInput : "new";
  const statusFilter = status === "all" ? "" : `&status=eq.${encodeURIComponent(status)}`;
  const rows = await supabaseFetch<WishRow[]>(
    `book_wishes?deleted_at=is.null${statusFilter}&select=${WISH_SELECT}&order=created_at.desc&limit=200`,
  );
  return rows.map(publicWish);
}

export async function updateAdminBookWishStatus(idInput: unknown, statusInput: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  const status = typeof statusInput === "string" ? statusInput.trim() : "";
  const allowed = new Set<BookWishStatus>(["new", "reviewing", "accepted", "rejected", "done"]);
  if (!id) throw new Error("找不到這筆願望。");
  if (!allowed.has(status as BookWishStatus)) throw new Error("願望狀態不正確。");
  const rows = await supabaseFetch<WishRow[]>(`book_wishes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      updated_at: new Date().toISOString(),
    }),
  });
  const row = rows[0];
  if (!row) throw new Error("找不到這筆願望。");
  return publicWish(row);
}

export async function deleteAdminBookWish(idInput: unknown) {
  const id = typeof idInput === "string" ? idInput.trim() : "";
  if (!id) throw new Error("找不到這筆願望。");
  await supabaseFetch<WishRow[]>(`book_wishes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  return { ok: true };
}

export function wishesAvailable(): boolean {
  return isSupabaseConfigured();
}
