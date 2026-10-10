"use client";

import { createContext, useContext, useMemo } from "react";
import {
  buildVendorCategories,
  useCustomVendorCategories,
} from "@/lib/collections/vendor-categories";

interface VendorCategoriesContextValue {
  categories: string[];
  loading: boolean;
  error: string | null;
}

const VendorCategoriesContext = createContext<VendorCategoriesContextValue>({
  categories: buildVendorCategories([]),
  loading: false,
  error: null,
});

/**
 * Subscribes to custom vendor categories once for the whole app shell, so the
 * Vendors tabs, Shortlist and Confirmed dropdowns (including one per row) all
 * read the same list without opening a Firestore listener per row.
 */
export function VendorCategoriesProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error } = useCustomVendorCategories();
  const value = useMemo(
    () => ({
      categories: buildVendorCategories(data.map((category) => category.name)),
      loading,
      error,
    }),
    [data, loading, error],
  );

  return (
    <VendorCategoriesContext.Provider value={value}>{children}</VendorCategoriesContext.Provider>
  );
}

export function useVendorCategories() {
  return useContext(VendorCategoriesContext);
}
