"use client";
import { useActionState } from "react";
import { login } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <Input name="password" type="password" placeholder="Password" aria-label="Password" autoComplete="current-password" autoFocus required aria-invalid={!!error} />
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "…" : "Log in"}</Button>
    </form>
  );
}
