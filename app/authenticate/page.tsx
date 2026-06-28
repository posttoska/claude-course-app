"use client";

// Authentication page (SPEC §7.4, §11) — the single entry point for signing in
// and signing up. It hosts both LoginForm and SignUpForm and toggles between
// them in place, so the user can switch modes without navigating. The forms own
// their own input state, validation, and error display; this page owns only the
// mode toggle and the post-success navigation.
//
// On success the forms invoke `onSuccess`, and this page redirects to
// /dashboard. better-auth's nextCookies() plugin has already set the session
// cookie by the time the client promise resolves, so router.refresh() lets the
// server re-read it for the destination route.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { SignUpForm } from "@/components/SignUpForm";

type Mode = "login" | "signup";

export default function AuthenticatePage() {
  const [mode, setMode] = useState<Mode>("login");
  const router = useRouter();
  const isLogin = mode === "login";

  function handleSuccess() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-foreground/60">
            {isLogin
              ? "Log in to access your notes."
              : "Sign up to start writing and sharing notes."}
          </p>
        </header>

        {isLogin ? (
          <LoginForm onSuccess={handleSuccess} />
        ) : (
          <SignUpForm onSuccess={handleSuccess} />
        )}

        <p className="text-center text-sm text-foreground/70">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(isLogin ? "signup" : "login")}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </main>
  );
}
