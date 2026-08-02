"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VenueGalleryDialogProps {
  name: string;
  images: string[];
  coverImage: string | null;
}

export function VenueGalleryDialog({ name, images, coverImage }: VenueGalleryDialogProps) {
  const [active, setActive] = useState(0);
  const thumb = coverImage ?? images[0];

  return (
    <Dialog onOpenChange={(open) => open && setActive(0)}>
      <DialogTrigger
        disabled={images.length === 0}
        className="group relative size-12 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted shadow-sm transition-transform hover:scale-105"
      >
        {thumb ? (
          <img src={thumb} alt={name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-5" />
          </div>
        )}
      </DialogTrigger>
      {images.length > 0 && (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">{name} photos</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <img
                src={images[active]}
                alt={`${name} photo ${active + 1}`}
                className="max-h-[60vh] w-full object-contain"
              />
            </div>
            {images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`size-14 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === active ? "border-primary" : "border-transparent"
                    }`}
                  >
                    <img src={img} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
