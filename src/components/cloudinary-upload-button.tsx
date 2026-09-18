"use client";

import { useCallback, useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CLOUDINARY_FREE_PLAN_MAX_BYTES, compressPdf } from "@/lib/compress-pdf";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  resourceType: string;
  format: string;
  bytes: number;
  originalFilename: string;
  mimeType: string;
}

interface CloudinaryUploadButtonProps {
  onUpload: (url: string, filename?: string, result?: CloudinaryUploadResult) => void | Promise<void>;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  /** Restrict uploads to a specific resource type. Defaults to "auto" (images, PDFs, docs, etc). */
  resourceType?: "auto" | "image";
  accept?: string;
  maxFileBytes?: number;
  onUploadProgress?: (progress: number, filename: string) => void;
}

export function CloudinaryUploadButton({
  onUpload,
  label = "Upload photo",
  variant = "outline",
  size = "sm",
  className,
  resourceType = "auto",
  accept,
  maxFileBytes,
  onUploadProgress,
}: CloudinaryUploadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = useCallback(() => {
    if (!isCloudinaryConfigured) return;
    setError(null);
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;

      setIsLoading(true);
      setError(null);
      try {
        for (let file of files) {
          const originalFilename = file.name;
          onUploadProgress?.(0, originalFilename);

          if (maxFileBytes && file.size > maxFileBytes && file.type !== "application/pdf") {
            throw new Error(`"${file.name}" is larger than the ${Math.round(maxFileBytes / (1024 * 1024))} MB limit.`);
          }

          if (
            file.type === "application/pdf" &&
            file.size > (maxFileBytes ?? CLOUDINARY_FREE_PLAN_MAX_BYTES)
          ) {
            file = await compressPdf(file, maxFileBytes ?? CLOUDINARY_FREE_PLAN_MAX_BYTES);
            if (file.size > (maxFileBytes ?? CLOUDINARY_FREE_PLAN_MAX_BYTES)) {
              throw new Error(
                `"${file.name}" is still too large after compressing. Try a smaller file.`,
              );
            }
          }

          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", UPLOAD_PRESET as string);

          const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(
              "POST",
              `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
            );
            xhr.upload.addEventListener("progress", (event) => {
              if (!event.lengthComputable) return;
              const nextProgress = Math.round((event.loaded / event.total) * 100);
              setProgress(nextProgress);
              onUploadProgress?.(nextProgress, originalFilename);
            });
            xhr.addEventListener("load", () => {
              try {
                const parsed = JSON.parse(xhr.responseText) as Record<string, unknown>;
                if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
                else reject(new Error(String((parsed.error as { message?: string } | undefined)?.message ?? "Upload failed")));
              } catch {
                reject(new Error("Upload failed"));
              }
            });
            xhr.addEventListener("error", () => reject(new Error("Upload failed. Check your connection.")));
            xhr.send(formData);
          });

          const result: CloudinaryUploadResult = {
            publicId: String(data.public_id ?? ""),
            secureUrl: String(data.secure_url ?? ""),
            resourceType: String(data.resource_type ?? resourceType),
            format: String(data.format ?? ""),
            bytes: Number(data.bytes ?? file.size),
            originalFilename,
            mimeType: file.type,
          };
          setProgress(100);
          onUploadProgress?.(100, originalFilename);
          await onUpload(result.secureUrl, originalFilename, result);
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsLoading(false);
        setProgress(0);
      }
    },
    [maxFileBytes, onUpload, onUploadProgress, resourceType],
  );

  const inputAccept = accept ?? (resourceType === "image" ? "image/*" : undefined);

  const button = (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={!isCloudinaryConfigured || isLoading}
      onClick={handleClick}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ImageUp className="size-4" />
      )}
      {size !== "icon" && (isLoading ? `${label} ${progress}%` : label)}
    </Button>
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={inputAccept}
        className="hidden"
        onChange={handleChange}
      />
      {isCloudinaryConfigured ? (
        button
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
            NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to enable file uploads.
          </TooltipContent>
        </Tooltip>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
