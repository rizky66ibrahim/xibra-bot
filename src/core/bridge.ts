// Single entry point for every call from the bot to the Xibra API bridge.
// Paths are relative to /api/v1/integrations/telegram.
import { config } from "./config.js";

export type BridgeFailure =
  | "unlinked"
  | "unauthorized"
  | "not_found"
  | "validation"
  | "unavailable";

export type BridgeResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: BridgeFailure; message: string };

export const UNLINKED_MESSAGE =
  'Akun Telegram ini belum terhubung. Buka dashboard Xibra, klik "Generate pairing code", lalu kirim /pair KODE.';

const TIMEOUT_MS = 8_000;

export async function bridge<T>(
  telegramUserId: number,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<BridgeResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${config.apiBase}/api/v1/integrations/telegram${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-Telegram-Bot-Secret": config.botSecret,
        "X-Telegram-User-Id": String(telegramUserId),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    console.error(`Xibra API unreachable (${cause?.code ?? (err as Error).message}) at ${config.apiBase}`);
    return { ok: false, reason: "unavailable", message: "Xibra API sedang tidak bisa dihubungi. Coba lagi nanti." };
  }

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    message?: string;
  };

  if (response.ok && json.success) {
    return { ok: true, data: json.data as T };
  }

  switch (response.status) {
    case 403:
      return { ok: false, reason: "unlinked", message: UNLINKED_MESSAGE };
    case 401:
      console.error("Bridge rejected: bot secret does not match the API configuration.");
      return { ok: false, reason: "unauthorized", message: "Konfigurasi bot belum benar. Hubungi pemilik Xibra." };
    case 404:
      return { ok: false, reason: "not_found", message: "Data tidak ditemukan." };
    case 400:
    case 422: {
      // Show the API's own message when it is specific (e.g. "Shift sudah tercatat")
      const specific = json.message && json.message !== "Validation failed" ? json.message : null;
      return { ok: false, reason: "validation", message: specific ?? "Data belum lengkap atau tidak valid." };
    }
    default:
      console.error(`Bridge ${method} ${path} failed with HTTP ${response.status}`);
      return { ok: false, reason: "unavailable", message: "Terjadi gangguan di Xibra. Coba lagi beberapa saat lagi." };
  }
}
