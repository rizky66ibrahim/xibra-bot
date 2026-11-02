import { config } from "./config.js";

export type BridgeResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason:
        | "unlinked"
        | "unauthorized"
        | "not_found"
        | "validation"
        | "unavailable";
      message: string;
    };

const UNLINKED_MESSAGE =
  'Akun Telegram ini belum terhubung ke Xibra. Buka dashboard Xibra, klik "Generate pairing code", lalu kirim /pair KODE.';

// Semua request bot ke jembatan API. Path relatif terhadap /api/v1/integrations/telegram.
export async function bridge<T>(
  telegramUserId: number,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<BridgeResult<T>> {
  let response: Response;

  try {
    response = await fetch(
      `${config.apiBase}/api/v1/integrations/telegram${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          "X-Telegram-Bot-Secret": config.botSecret,
          "X-Telegram-User-Id": String(telegramUserId),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (err) {
    console.error("Xibra API unreachable:", (err as Error).message);
    return {
      ok: false,
      reason: "unavailable",
      message: "Xibra API sedang tidak bisa dihubungi. Coba lagi nanti.",
    };
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
      console.error(
        "Bridge rejected: bot secret does not match the API configuration.",
      );
      return {
        ok: false,
        reason: "unauthorized",
        message: "Konfigurasi bot belum benar. Hubungi pemilik Xibra.",
      };
    case 404:
      return {
        ok: false,
        reason: "not_found",
        message: "Data tidak ditemukan.",
      };
    case 400:
    case 422:
      return {
        ok: false,
        reason: "validation",
        message: "Data belum lengkap atau tidak valid. Coba lagi.",
      };
    default:
      console.error(
        `Bridge ${method} ${path} failed with HTTP ${response.status}`,
      );
      return {
        ok: false,
        reason: "unavailable",
        message: "Terjadi gangguan di Xibra. Coba lagi beberapa saat lagi.",
      };
  }
}

export { UNLINKED_MESSAGE };
