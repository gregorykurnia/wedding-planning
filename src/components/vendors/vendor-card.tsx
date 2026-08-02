"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ImageIcon, Mail, PiggyBank, Phone, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CloudinaryUploadButton } from "@/components/cloudinary-upload-button";
import { EditableText } from "@/components/shared/editable-text";
import {
  addVendorImage,
  deleteVendor,
  updateVendor,
} from "@/lib/collections/vendors";
import { createBudgetItemFromVendor } from "@/lib/collections/budget-items";
import type { ContractStatus, Vendor, VendorCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: VendorCategory[] = [
  "Caterer",
  "Florist",
  "Photographer",
  "Videographer",
  "Music/DJ",
  "Makeup Artist",
  "Decoration",
  "Wedding Organizer",
  "Other",
];

const CONTRACT_STATUSES: ContractStatus[] = [
  "Not Contacted",
  "In Talks",
  "Contracted",
  "Paid",
];

const CONTRACT_STYLES: Record<ContractStatus, string> = {
  "Not Contacted": "bg-muted text-muted-foreground border-border",
  "In Talks": "bg-amber-100 text-amber-800 border-amber-200",
  Contracted: "bg-sky-100 text-sky-800 border-sky-200",
  Paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function VendorCard({
  vendor,
  addedToBudget = false,
}: {
  vendor: Vendor;
  addedToBudget?: boolean;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const cover = vendor.images[0];
  const isConfirmed = vendor.contractStatus === "Contracted" || vendor.contractStatus === "Paid";

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        className="block h-36 w-full bg-muted"
        onClick={() => vendor.images.length > 0 && setGalleryOpen(true)}
      >
        {cover ? (
          <img src={cover} alt={vendor.name} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
      </button>

      <CardHeader className="gap-1 pb-0">
        <div className="flex items-start justify-between gap-2">
          <EditableText
            value={vendor.name}
            onSave={(name) => updateVendor(vendor.id, { name })}
            className="font-heading text-lg font-semibold text-foreground"
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => deleteVendor(vendor.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        <Select
          value={vendor.category}
          onValueChange={(v) => updateVendor(vendor.id, { category: v as VendorCategory })}
        >
          <SelectTrigger size="sm" className="h-7 w-fit border-none bg-secondary/60 px-2.5 text-xs text-secondary-foreground shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pt-3">
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" />
            <EditableText
              value={vendor.contactPhone}
              onSave={(contactPhone) => updateVendor(vendor.id, { contactPhone })}
              placeholder="Add phone"
              className="px-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" />
            <EditableText
              value={vendor.contactEmail}
              onSave={(contactEmail) => updateVendor(vendor.id, { contactEmail })}
              placeholder="Add email"
              className="px-0"
            />
          </div>
        </div>

        <Select
          value={vendor.contractStatus}
          onValueChange={(v) =>
            updateVendor(vendor.id, { contractStatus: v as ContractStatus })
          }
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "h-7 w-fit gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
              CONTRACT_STYLES[vendor.contractStatus],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <EditableText
          value={vendor.notes}
          onSave={(notes) => updateVendor(vendor.id, { notes })}
          placeholder="Add notes…"
          multiline
          className="rounded-lg bg-muted/40 px-2.5 py-2 text-sm text-foreground"
        />

        <div className="flex items-center justify-between gap-2 pt-1">
          {vendor.images.length > 0 ? (
            <Badge variant="secondary" className="text-xs font-normal">
              {vendor.images.length} photo{vendor.images.length > 1 ? "s" : ""}
            </Badge>
          ) : (
            <span />
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {isConfirmed && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={addedToBudget}
                      className={addedToBudget ? "text-emerald-600" : "text-muted-foreground"}
                      onClick={() => createBudgetItemFromVendor(vendor)}
                    />
                  }
                >
                  <PiggyBank className="size-4" />
                </TooltipTrigger>
                <TooltipContent>
                  {addedToBudget ? "Already added to budget" : "Add to budget"}
                </TooltipContent>
              </Tooltip>
            )}
            <CloudinaryUploadButton
              size="sm"
              label="Add photos"
              onUpload={(url) => addVendorImage(vendor, url)}
            />
          </div>
        </div>
      </CardContent>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">{vendor.name} photos</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {vendor.images.map((img, i) => (
              <img
                key={img + i}
                src={img}
                alt={`${vendor.name} ${i + 1}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
