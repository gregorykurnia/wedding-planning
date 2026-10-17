"use client";

import { useCallback } from "react";
import { usePartnerName, usePartnerNews, type PartnerNews } from "@/lib/data/partner";
import { useSession } from "@/lib/data/session";
import { useFlasher } from "./flash";
import { useToast, useToastPartnerName } from "./toasts";

/**
 * Turns the partner's changes, and your own from another device (N3), into a
 * toast and a flash (guide §6.3), and tells the toast host the partner's name. Renders
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
  // The "Can’t undo" toast (N13) names the partner too.
  useToastPartnerName(usePartnerName().name);
  usePartnerNews(
    useCallback(
      (news: PartnerNews) => {
        if (news.text) (news.own ? toast.own : toast.partner)(news.name, news.text);
        flash(news.flash);
      },
      [toast, flash],
    ),
  );
  return null;
}
