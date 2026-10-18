import type { Metadata } from "next";
import { FinalistScreen } from "@/veil/screens/finalist/finalist-screen";

export const metadata: Metadata = { title: "Finalist" };

export default async function FinalistPage({ params }: { params: Promise<{ finalistId: string }> }) {
  const { finalistId } = await params;
  return <FinalistScreen finalistId={finalistId} />;
}
