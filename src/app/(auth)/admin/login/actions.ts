"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { issueAdminSession, verifyPasscode } from "@/lib/auth/passcode";
import { checkRateLimit, clientIp } from "@/lib/security/ratelimit";
import { logger } from "@/lib/security/logger";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

const passcodeSchema = z.object({
  passcode: z.string().min(1, "Enter the admin password.").max(200),
});

export type LoginState = { error?: string };

const LOGIN_LIMIT = 10; // attempts per 15 min per IP

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const h = await headers();
  const ip = clientIp(h);
  const rl = await checkRateLimit(`login:${ip}`, LOGIN_LIMIT);
  if (!rl.allowed) {
    logger.warn("login rate-limited", { ip });
    // Generic message — do not reveal the limiter state.
    return { error: "Invalid email or password." };
  }

  let error: { message: string } | null = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    error = result.error;
  } catch {
    error = { message: "Sign-in unavailable." };
  }
  if (error) {
    logger.warn("failed login attempt", { ip });
    // Generic error — never reveal whether the email exists.
    return { error: "Invalid email or password." };
  }

  redirect("/admin");
}

/**
 * Shared-password sign-in (D42). The owner's own way into `/admin` when no
 * account exists.
 *
 * Rate-limited exactly like the account login above, compared in constant time,
 * and the failure message is the same whether the password was wrong or the
 * limiter tripped — the form never tells a guesser how close it got.
 */
export async function passcodeAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = passcodeSchema.safeParse({ passcode: formData.get("passcode") });
  if (!parsed.success) return { error: "Enter the admin password." };

  const h = await headers();
  const ip = clientIp(h);
  const rl = await checkRateLimit(`login:${ip}`, LOGIN_LIMIT);
  if (!rl.allowed) {
    logger.warn("passcode login rate-limited", { ip });
    return { error: "Incorrect password." };
  }

  if (!verifyPasscode(parsed.data.passcode)) {
    logger.warn("failed passcode attempt", { ip });
    return { error: "Incorrect password." };
  }

  await issueAdminSession();
  logger.info("admin signed in with the shared password", { ip });
  redirect("/admin");
}
