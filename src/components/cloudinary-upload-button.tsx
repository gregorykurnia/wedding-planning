"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (
          error: unknown,
          result: {
            event: string;
            info?: { secure_url: string; original_filename?: string };
          },
        ) => void,
      ) => { open: () => void };
    };
  }
}

const WIDGET_SCRIPT_SRC = "https://upload-widget.cloudinary.com/global/all.js";
let scriptLoadingPromise: Promise<void> | null = null;

function loadCloudinaryScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.cloudinary) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Cloudinary widget script"));
    document.body.appendChild(script);
  });
  return scriptLoadingPromise;
}

interface CloudinaryUploadButtonProps {
  onUpload: (url: string, filename?: string) => void;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "icon";
  className?: string;
  /** Restrict the widget to a specific resource type. Defaults to "auto" (images, PDFs, docs, etc). */
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
  const widgetRef = useRef<{ open: () => void } | null>(null);

  useEffect(() => {
    return () => {
      widgetRef.current = null;
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (!isCloudinaryConfigured) return;
    setIsLoading(true);
    try {
      await loadCloudinaryScript();
      if (!window.cloudinary) throw new Error("Cloudinary widget unavailable");

      const widget = window.cloudinary.createUploadWidget(
        {
          cloudName: CLOUD_NAME,
          uploadPreset: UPLOAD_PRESET,
          multiple: true,
          resourceType,
          sources: ["local", "url", "camera"],
          styles: {
            palette: {
              window: "#FDF8F2",
              windowBorder: "#D8C3A5",
              tabIcon: "#B6714A",
              menuIcons: "#8A7355",
              textDark: "#3A2E22",
              textLight: "#FFFFFF",
              link: "#B6714A",
              action: "#B6714A",
              inactiveTabIcon: "#B6B0A5",
              error: "#C0392B",
              inProgress: "#B6714A",
              complete: "#7C9A72",
              sourceBg: "#F4EEE3",
            },
          },
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return;
          }
          if (result?.event === "success" && result.info?.secure_url) {
            onUpload(result.info.secure_url, result.info.original_filename);
          }
        },
      );
      widgetRef.current = widget;
      widget.open();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [onUpload]);

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

  if (isCloudinaryConfigured) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} />}>{button}</TooltipTrigger>
      <TooltipContent>
        Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and
        NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to enable photo uploads.
      </TooltipContent>
    </Tooltip>
  );
}
