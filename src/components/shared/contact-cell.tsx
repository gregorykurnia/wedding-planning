"use client";

import { MessageCircle } from "lucide-react";
import { EditableText } from "@/components/shared/editable-text";

interface ContactCellProps {
  name: string;
  phone: string;
  onSaveName: (name: string) => void;
  onSavePhone: (phone: string) => void;
}

/**
 * PIC name + phone number, with a WhatsApp deep-link icon next to the
 * number so the number itself stays editable inline.
 */
export function ContactCell({ name, phone, onSaveName, onSavePhone }: ContactCellProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <EditableText value={name} onSave={onSaveName} placeholder="PIC name" className="text-sm" />
      <div className="flex items-center gap-1">
        {phone && (
          <a
            href={`https://wa.me/${phone.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open WhatsApp chat"
            className="shrink-0 text-green-600 hover:text-green-700"
          >
            <MessageCircle className="size-3.5" />
          </a>
        )}
        <EditableText
          value={phone}
          onSave={onSavePhone}
          placeholder="Add phone"
          className="px-0 text-xs text-muted-foreground"
        />
      </div>
    </div>
  );
}
