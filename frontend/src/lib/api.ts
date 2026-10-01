import { readToken } from "@/lib/token";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/** An error carrying the HTTP status, so callers can branch on 401 vs 409. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Set false for endpoints that must not send credentials (login, signup). */
  auth?: boolean;
}

/**
 * Extract a human-readable message from a FastAPI error body.
 *
 * `detail` is a string for our own HTTPExceptions, but an array of validation
 * objects when Pydantic rejects the request, so both shapes are handled.
 */
function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
      if (first?.msg) {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : null;
        return field ? `${String(field)}: ${first.msg}` : first.msg;
      }
    }
  }

  if (status === 0) return "Cannot reach the server. Is the backend running?";
  return `Request failed (${status})`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = readToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    // fetch only rejects on network failure, never on a non-2xx status.
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(messageFromBody(payload, response.status), response.status);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PUT", body }),
};
