import { createAuthClient } from "better-auth/react";

// Same-origin app, so baseURL can be omitted.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
