"use client";

import { FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CloudinaryUploadButton } from "@/components/cloudinary-upload-button";
import type { VendorFile } from "@/lib/types";

interface FilesCellProps {
  files: VendorFile[];
  onAdd: (file: VendorFile) => void;
  onRemove: (url: string) => void;
}

export function FilesCell({ files, onAdd, onRemove }: FilesCellProps) {
  return (
    <div className="flex min-w-[160px] flex-col gap-1.5">
      {files.map((file) => (
        <div key={file.url} className="flex items-center gap-1">
          <Badge
            variant="secondary"
            className="max-w-[160px] gap-1 text-xs font-normal"
          >
            <a
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 truncate"
              title={file.name}
            >
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{file.name}</span>
            </a>
          </Badge>
          <button
            type="button"
            onClick={() => onRemove(file.url)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      <CloudinaryUploadButton
        size="sm"
        variant="ghost"
        label="Attach file"
        resourceType="auto"
        className="h-7 w-fit px-2 text-xs text-muted-foreground"
        onUpload={(url, filename) => {
          onAdd({ url, name: filename || url.split("/").pop() || "file" });
        }}
      />
    </div>
  );
}
