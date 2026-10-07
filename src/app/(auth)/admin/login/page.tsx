import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin sign in — Waseem Sports" };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <p className="font-display text-2xl font-bold">
        Waseem <span className="text-gold-400">Sports</span>
      </p>
      <h1 className="mb-6 mt-2 text-lg text-muted">Admin sign in</h1>
      <LoginForm />
    </main>
  );
}
