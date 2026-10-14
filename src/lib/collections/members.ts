"use client";

import type { DocumentData } from "firebase/firestore";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/lib/use-collection";
import { millis, str } from "@/lib/data/adapters/common";

// One record per account, written at sign-in by recordMember()
// (src/lib/data/members.ts). The id is the account's uid.
const COLLECTION = "members";

export interface Member {
  id: string;
  email: string;
  provider: string;
  lastSeenAt: number | null;
}

function fromDoc(id: string, data: DocumentData): Member {
  return {
    id,
    email: str(data.email),
    provider: str(data.provider),
    lastSeenAt: millis(data.lastSeenAt),
  };
}

export function useMembers() {
  return useCollection<Member>(COLLECTION, fromDoc, [orderBy("email", "asc")]);
}
