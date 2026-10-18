import type { Metadata } from "next";
import { VendorScreen } from "@/veil/screens/vendor/vendor-screen";

export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  return <VendorScreen vendorId={vendorId} />;
}
