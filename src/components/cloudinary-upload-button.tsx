"use client";

import { useCallback, useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

interface CloudinaryUploadButtonProps {
  onUpload: (url: string, filename?: string) => void;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  /** Restrict uploads to a specific resource type. Defaults to "auto" (images, PDFs, docs, etc). */
  resourceType?: "auto" | "image";
}

export function CloudinaryUploadButton({
  onUpload,
  label = "Upload photo",
  variant = "outline",
  size = "sm",
  className,
  resourceType = "auto",
}: CloudinaryUploadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = useCallback(() => {
    if (!isCloudinaryConfigured) return;
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;

      setIsLoading(true);
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", UPLOAD_PRESET as string);

          const res = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
            { method: "POST", body: formData },
          );
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          onUpload(data.secure_url, data.original_filename ?? file.name);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [onUpload, resourceType],
  );

  const accept = resourceType === "image" ? "image/*" : undefined;

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
      {size !== "icon" && label}
    </Button>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
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
            NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to enable photo uploads.
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
