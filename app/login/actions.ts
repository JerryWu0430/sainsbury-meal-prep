"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, MAX_AGE_S, passwordOk, sign } from "@/lib/auth";

// only same-site paths — never "//evil.com"
const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export async function login(_: string | null, form: FormData): Promise<string | null> {
  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET) return "Login isn't configured — set APP_PASSWORD and AUTH_SECRET.";
  if (!passwordOk(String(form.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 600)); // slows guessing
    return "Wrong password.";
  }
  (await cookies()).set(COOKIE, sign(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE_S });
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
