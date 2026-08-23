"use client";

import { FilesCell } from "@/components/shared/files-cell";
import type { Vendor } from "@/lib/types";
import { addVendorFile, removeVendorFile } from "@/lib/collections/vendors";
import { useWorkspace } from "@/lib/workspace-context";

interface VendorFilesCellProps {
  vendor: Vendor;
}

export function VendorFilesCell({ vendor }: VendorFilesCellProps) {
  const { workspace } = useWorkspace();
  return (
    <FilesCell
      files={vendor.files}
      onAdd={(file) => addVendorFile(workspace!.id, vendor, file)}
      onRemove={(url) => removeVendorFile(workspace!.id, vendor, url)}
    />
  );
}
