import { createSign } from "node:crypto";
import { indexBookFolder, type DriveItem } from "./library.ts";
import type { Book } from "./types.ts";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
let tokenCache: { token: string; expiresAt: number } | undefined;

export class DriveApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "DriveApiError";
  }
}

export function driveErrorMessage(status: number): string {
  if (status === 401 || status === 403) return "Google Drive 授權失敗，請檢查 service account 與資料夾分享權限。";
  if (status === 404) return "找不到指定的 Google Drive 資料夾或檔案。";
  if (status === 429) return "Google Drive 查詢次數暫時過多，請稍後再試。";
  return "Google Drive 暫時無法讀取，請稍後再試。";
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function credentials() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) return null;
  return { email, privateKey };
}

export function isDriveConfigured(): boolean {
  return Boolean(credentials() && process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID);
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const serviceAccount = credentials();
  if (!serviceAccount) throw new Error("Google service account is not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.email,
    scope: DRIVE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(serviceAccount.privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    cache: "no-store",
  });
  if (!response.ok) throw new DriveApiError(response.status, driveErrorMessage(response.status));
  const body = await response.json() as { access_token: string; expires_in: number };
  tokenCache = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init?.headers },
    cache: init?.cache ?? "no-store",
  });
  if (!response.ok && response.status !== 206) throw new DriveApiError(response.status, driveErrorMessage(response.status));
  return response;
}

async function driveUploadFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${DRIVE_UPLOAD_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init?.headers },
    cache: init?.cache ?? "no-store",
  });
  if (!response.ok) throw new DriveApiError(response.status, driveErrorMessage(response.status));
  return response;
}

async function listChildren(parentId: string): Promise<DriveItem[]> {
  const files: DriveItem[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${parentId}' in parents and trashed = false`,
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await driveFetch(`/files?${params}`);
    const body = await response.json() as { files: DriveItem[]; nextPageToken?: string };
    files.push(...body.files);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function getDriveFile(fileId: string, fields = "id,name,mimeType,parents,modifiedTime,size"): Promise<DriveItem & { parents?: string[] }> {
  const response = await driveFetch(`/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`);
  return response.json() as Promise<DriveItem & { parents?: string[] }>;
}

export async function buildDriveLibrary(): Promise<Book[]> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured");
  const folders = (await listChildren(rootId)).filter((item) => item.mimeType === FOLDER_MIME_TYPE);
  const books = await Promise.all(folders.map(async (folder) => indexBookFolder(folder, await listChildren(folder.id))));
  return books.filter((book): book is Book => Boolean(book)).sort((a, b) => a.title.localeCompare(b.title, "zh-Hant"));
}

async function fileIsInsideRoot(fileId: string): Promise<boolean> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) return false;
  const file = await getDriveFile(fileId, "id,parents");
  for (const parentId of file.parents ?? []) {
    if (parentId === rootId) return true;
    const parent = await getDriveFile(parentId, "id,parents");
    if (parent.parents?.includes(rootId)) return true;
  }
  return false;
}

export async function streamDriveFile(fileId: string, range?: string | null): Promise<Response> {
  if (!await fileIsInsideRoot(fileId)) throw new DriveApiError(404, "檔案不在允許的書庫範圍內。");
  return driveFetch(`/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: range ? { Range: range } : undefined,
  });
}

const AUDIO_CHUNK_BYTES = 4 * 1024 * 1024;

export function normalizeAudioRange(range?: string | null): string {
  const match = range?.match(/^bytes=(\d+)-(\d*)$/i);
  const start = match ? Number(match[1]) : 0;
  const requestedEnd = match?.[2] ? Number(match[2]) : Number.POSITIVE_INFINITY;
  const end = Math.min(requestedEnd, start + AUDIO_CHUNK_BYTES - 1);
  return `bytes=${start}-${end}`;
}

function coverNameForMime(mimeType: string): string {
  if (mimeType === "image/png") return "cover.png";
  if (mimeType === "image/webp") return "cover.webp";
  return "cover.jpg";
}

function findCover(children: DriveItem[]): DriveItem | undefined {
  const image = (file: DriveItem) => ["image/jpeg", "image/png", "image/webp"].includes(file.mimeType);
  return children.find((file) => image(file) && /cover|封面/i.test(file.name))
    ?? children.find((file) => image(file));
}

async function assertBookFolder(bookId: string): Promise<DriveItem> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!rootId) throw new Error("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured");
  const folder = await getDriveFile(bookId);
  if (folder.mimeType !== FOLDER_MIME_TYPE || !folder.parents?.includes(rootId)) {
    throw new DriveApiError(404, "指定資料夾不在允許的書庫範圍內。");
  }
  return folder;
}

function multipartDriveBody(metadata: Record<string, unknown>, data: Buffer, mimeType: string) {
  const boundary = `codex-cover-${Date.now().toString(36)}`;
  const head = Buffer.from(
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return {
    boundary,
    body: new Uint8Array(Buffer.concat([head, data, tail])),
  };
}

async function createDriveCover(bookId: string, data: Buffer, mimeType: string): Promise<DriveItem> {
  const { boundary, body } = multipartDriveBody({
    name: coverNameForMime(mimeType),
    parents: [bookId],
    mimeType,
  }, data, mimeType);
  const response = await driveUploadFetch("/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size", {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json() as Promise<DriveItem>;
}

async function updateDriveCover(fileId: string, data: Buffer, mimeType: string): Promise<DriveItem> {
  const { boundary, body } = multipartDriveBody({
    name: coverNameForMime(mimeType),
    mimeType,
  }, data, mimeType);
  const response = await driveUploadFetch(`/files/${encodeURIComponent(fileId)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size`, {
    method: "PATCH",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json() as Promise<DriveItem>;
}

export async function replaceBookCover(bookId: string, data: Buffer, mimeType: string): Promise<Book> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new Error("只支援 JPG、PNG 或 WebP 封面。");
  }
  await assertBookFolder(bookId);
  const before = await listChildren(bookId);
  const currentCover = findCover(before);
  if (currentCover) {
    await updateDriveCover(currentCover.id, data, mimeType);
  } else {
    await createDriveCover(bookId, data, mimeType);
  }
  const folder = await getDriveFile(bookId);
  const book = indexBookFolder(folder, await listChildren(bookId));
  if (!book) throw new Error("封面已更新，但書籍資料夾沒有可用音檔。");
  return book;
}
