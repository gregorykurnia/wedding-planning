"use client";

import { FilesCell } from "@/components/shared/files-cell";
import type { Vendor } from "@/lib/types";
import { addVendorFile, removeVendorFile } from "@/lib/collections/vendors";

interface VendorFilesCellProps {
  vendor: Vendor;
}

export function VendorFilesCell({ vendor }: VendorFilesCellProps) {
  return (
    <FilesCell
      files={vendor.files}
      onAdd={(file) => addVendorFile(vendor, file)}
      onRemove={(url) => removeVendorFile(vendor, url)}
    />
  );
}
