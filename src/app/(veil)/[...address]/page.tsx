import { notFound } from "next/navigation";

// Any address no other page matches. Routing alone would answer
// with Next's plain 404, outside the shell; notFound() hands it to not-found.tsx.
export default function UnmatchedAddress() {
  notFound();
}
