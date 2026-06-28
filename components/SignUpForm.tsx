"use client";

// Sign-up form (SPEC §7.4) — a controlled client component that creates an
// account via the better-auth browser client. It owns input state, runs
// lightweight client-side validation, surfaces server errors inline, and on
// success defers navigation to the parent through `onSuccess` (the authenticate
// page redirects to /dashboard). The authoritative validation still happens on
// the server; these checks are only for fast feedback.

import { useState } from "react";
import { signUp } from "@/lib/auth-client";

/** Matches the better-auth default (`emailAndPassword` minimum password length). */
const MIN_PASSWORD_LENGTH = 8;

/** Pragmatic email shape check — the server is the source of truth. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignUpFormProps = {
  /** Called after the account is created; the parent handles redirecting. */
  onSuccess?: () => void;
};

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return "Please enter your name.";
    if (!EMAIL_PATTERN.test(email)) return "Please enter a valid email address.";
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
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
    const { error: signUpError } = await signUp.email({
      name: name.trim(),
      email,
      password,
    });
    setPending(false);

    if (signUpError) {
      setError(signUpError.message ?? "Something went wrong. Please try again.");
      return;
    }

    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="signup-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/20 disabled:opacity-60"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
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
        {pending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
