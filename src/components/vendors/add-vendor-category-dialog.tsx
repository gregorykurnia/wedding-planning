"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addVendorCategory,
  MAX_VENDOR_CATEGORY_LENGTH,
  validateVendorCategoryName,
} from "@/lib/collections/vendor-categories";
import { useVendorCategories } from "@/components/vendors/vendor-categories-provider";

interface AddVendorCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shared "new category" dialog. Vendors, Shortlist and Confirmed all open this,
 * so a category added in any one of them appears in all three.
 */
export function AddVendorCategoryDialog({ open, onOpenChange }: AddVendorCategoryDialogProps) {
  const { categories } = useVendorCategories();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateVendorCategoryName(name, categories);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addVendorCategory(name);
      handleOpenChange(false);
    } catch (err) {
      console.error("Error adding vendor category:", err);
      setError(err instanceof Error ? err.message : "Couldn't add that category. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New vendor category</DialogTitle>
          <DialogDescription>
            It appears in Vendors, Shortlist and Confirmed for everyone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vendor-category-name" className="text-xs font-medium">
              Category name
            </label>
            <Input
              id="vendor-category-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Florist"
              autoFocus
              maxLength={MAX_VENDOR_CATEGORY_LENGTH}
              aria-invalid={error ? true : undefined}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? "Adding…" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
