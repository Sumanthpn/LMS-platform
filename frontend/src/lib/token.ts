/**
 * The JWT is kept in a cookie rather than localStorage so that `middleware.ts`
 * can gate protected routes on the server, before any HTML is sent.
 *
 * It is NOT httpOnly — the browser has to attach it to API calls, and the token
 * is issued by the FastAPI backend rather than a Next route handler. That makes
 * it readable by scripts on this origin, the same exposure localStorage carries.
 * See the security note in the README.
 */

export const TOKEN_COOKIE = "lms_token";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function readToken(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${TOKEN_COOKIE}=`));

  return match ? decodeURIComponent(match.slice(TOKEN_COOKIE.length + 1)) : null;
}

export function writeToken(token: string): void {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; ` +
    `max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
