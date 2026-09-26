import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-6">
        <h1 className="font-serif text-3xl leading-none tracking-tight">
          Sainsbury&apos;s <span className="text-muted-foreground">E&amp;C</span>
        </h1>
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </main>
  );
}
