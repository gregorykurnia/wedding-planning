import type { Metadata } from "next";
import { SignInScreen } from "@/veil/screens/sign-in/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignInScreen />;
}
