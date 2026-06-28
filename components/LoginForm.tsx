"use client";

// Login form (SPEC §7.4) — a controlled client component that signs a user in
// via the better-auth browser client. Mirrors SignUpForm (same pattern, styling,
// and a11y) but omits the name field and uses `signIn.email`. It owns input
// state, runs lightweight client-side validation, surfaces server errors inline,
// and on success defers navigation to the parent through `onSuccess` (the
// authenticate page redirects to /dashboard). The server stays authoritative;
// these checks are only for fast feedback.

import { useState } from "react";
import { signIn } from "@/lib/auth-client";

/** Pragmatic email shape check — the server is the source of truth. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginFormProps = {
  /** Called after a successful sign-in; the parent handles redirecting. */
  onSuccess?: () => void;
};

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function validate(): string | null {
    if (!EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";
    if (!password) return "Please enter your password.";
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPending(true);
    const { error: signInError } = await signIn.email({ email, password });
    setPending(false);

    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }

    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Log in"}
      </button>
    </form>
  );
}
