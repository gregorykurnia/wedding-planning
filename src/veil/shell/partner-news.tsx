"use client";

import { useCallback } from "react";
import { usePartnerNews, type PartnerNews } from "@/lib/data/partner";
import { useSession } from "@/lib/data/session";
import { useFlasher } from "./flash";
import { useToast } from "./toasts";

/**
 * Turns the partner's changes into a toast and a flash (guide §6.3). Renders
 * nothing; mounted once by the providers, and listening only while an allowed
 * account is signed in (demo mode has no partner).
 */
export function PartnerNewsListener() {
  const session = useSession();
  return session.status === "signed-in" ? <Listening /> : null;
}

function Listening() {
  const toast = useToast();
  const flash = useFlasher();
  usePartnerNews(
    useCallback(
      (news: PartnerNews) => {
        if (news.text) toast.partner(news.name, news.text);
        flash(news.flash);
      },
      [toast, flash],
    ),
  );
  return null;
}
