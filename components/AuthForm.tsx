"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth-client";

export type AuthMode = "signin" | "signup";

const COPY = {
  signin: {
    heading: "Sign in",
    submit: "Sign in",
    pending: "Signing in…",
    prompt: "Don’t have an account?",
    toggleLabel: "Create one",
    toggleHref: "/login?mode=signup",
    fallbackError: "Could not sign in. Check your email and password.",
  },
  signup: {
    heading: "Create your account",
    submit: "Create account",
    pending: "Creating account…",
    prompt: "Already have an account?",
    toggleLabel: "Sign in",
    toggleHref: "/login",
    fallbackError: "Could not create your account. Please try again.",
  },
} as const satisfies Record<AuthMode, unknown>;

const fieldClass =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/15 dark:border-white/20";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const copy = COPY[mode];
  const isSignup = mode === "signup";

  const [error, submit, isPending] = useActionState<string | null, FormData>(
    async (_prev, formData) => {
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      const result = isSignup
        ? await signUp.email({
            email,
            password,
            name: String(formData.get("name") ?? "").trim(),
          })
        : await signIn.email({ email, password });

      if (result.error) return result.error.message ?? copy.fallbackError;

      router.push("/dashboard");
      router.refresh();
      return null;
    },
    null,
  );

  return (
    <form action={submit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">{copy.heading}</h1>

      {isSignup && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={100}
            className={fieldClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
          className={fieldClass}
        />
        {isSignup && <p className="text-xs text-foreground/60">At least 8 characters.</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? copy.pending : copy.submit}
      </button>

      <p className="text-sm text-foreground/70">
        {copy.prompt}{" "}
        <Link href={copy.toggleHref} className="font-medium underline underline-offset-4">
          {copy.toggleLabel}
        </Link>
      </p>
    </form>
  );
}
