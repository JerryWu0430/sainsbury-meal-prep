// Single-password gate. Cookie = "<exp>.<hmac(AUTH_SECRET, exp)>" — sains/auth.py verifies the same format for /api/ask.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "sains_auth";
export const MAX_AGE_S = 30 * 86400;

// on locally without APP_PASSWORD (dev stays open); always on on Vercel, so a missing env fails closed
export const authEnabled = () => !!process.env.APP_PASSWORD || process.env.VERCEL === "1";

const sig = (exp: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(exp).digest("base64url");
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export function sign(now = Date.now()): string {
  const exp = String(Math.floor(now / 1000) + MAX_AGE_S);
  return `${exp}.${sig(exp)}`;
}

export function verify(token?: string): boolean {
  if (!token || !process.env.AUTH_SECRET) return false;
  const [exp, s] = token.split(".");
  return +exp > Date.now() / 1000 && !!s && same(s, sig(exp));
}

export const passwordOk = (pw: string) => !!process.env.APP_PASSWORD && same(pw, process.env.APP_PASSWORD);
