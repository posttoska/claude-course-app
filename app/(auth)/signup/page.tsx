import { redirect } from "next/navigation";

// Auth lives on a single page; sign-up is the `?mode=signup` variant of /login.
// Keep the /signup URL working by redirecting to it.
export default function SignupPage() {
  redirect("/login?mode=signup");
}
