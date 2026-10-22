import type { Metadata } from "next";
import { connection } from "next/server";
import { SignInScreen } from "@/veil/screens/sign-in/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <SignInScreen />;
}
