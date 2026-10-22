"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { useEffect, useRef, useState } from "react";
import { setVendorKeen, useVendorsAndCategories } from "@/lib/data/vendors";
import { useSettings } from "@/lib/data/settings";
import { buildCategories } from "@/lib/model/categories";
import { exportFileName } from "@/lib/model/csv";
import { VENDOR_RULED_OUT } from "@/lib/model/labels";
import { VENDOR_ORDERS, type VendorOrderKey } from "@/lib/model/order";
import { isFilteringVendors, type VendorFilter } from "@/lib/model/search";
import {
  groupByCategory,
  keenCount,
  vendorFocus,
  vendorView,
  vendorsCsv,
  type VendorListItem,
} from "@/lib/model/vendors";
import { n0 } from "@/lib/model/format";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FocusChips } from "@/veil/parts/chips/focus-chips";
import { Hero } from "@/veil/parts/hero/hero";
import { KeenHeart } from "@/veil/parts/keen/keen-heart";
import { keenFailed, keenToast } from "@/veil/parts/keen/keen-text";
import { Message } from "@/veil/parts/message/message";
import { Ledger } from "@/veil/parts/rows/ledger";
import { VendorRow, type VendorRowData } from "@/veil/parts/rows/vendor-row";
import { StageThread } from "@/veil/parts/stage/stage-thread";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { FilterCheck, ShowEverything } from "@/veil/parts/tools/filters";
import { SearchField } from "@/veil/parts/tools/search-field";
import { OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { FilterBar, Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";
import { downloadText } from "@/veil/download";
import { replaceAddress, veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { useToast } from "@/veil/shell/toasts";
import { AddVendorSheet } from "./add-vendor-sheet";
import { CategoriesSheet } from "./categories-sheet";
import styles from "./vendors-screen.module.css";
import { NOTHING_YET, countText, exportLabel, exportedToast, noResults, vendorsSub } from "./vendors-text";

/** Vendors shown at a time (guide §6.8). */
const PAGE = 100;

/** Vendors (guide §5.11, F6, F9, F11–F15, F23). */
export function VendorsScreen() {
  const read = useVendorsAndCategories();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your vendors" onRetry={() => window.location.reload()}>
        {(data) => <VendorsList vendors={data?.[0] ?? []} categories={data?.[1].list ?? buildCategories([])} />}
      </ScreenState>
    </PageColumn>
  );
}

type KeenChange = { keen: boolean; failed: boolean };

function VendorsList({ vendors, categories }: { vendors: VendorListItem[]; categories: string[] }) {
  const sheets = useSheets();
  const toast = useToast();
  const settings = useSettings().data;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [keen, setKeen] = useState(false);
  const [order, setOrder] = useState<OrderState<VendorOrderKey>>({ key: "category", direction: "asc" });
  const [shown, setShown] = useState(PAGE);
  // A heart that was pressed and hasn't landed (or didn't): the choice shows meanwhile.
  const [changes, setChanges] = useState<Record<string, KeenChange>>({});
  const offline = !useOnline();

  const filter: VendorFilter = { query, category, keen };
  const filtering = isFilteringVendors(filter);
  const view = vendorView(vendors, filter, order, categories, shown, PAGE);
  const page = view.rows.slice(0, view.shown);
  const grouped = order.key === "category" && !category;

  const openAdd = () => sheets.open(<AddVendorSheet category={category} />);
  const openCategories = () =>
    sheets.open(
      <CategoriesSheet
        onRenamed={(from, to) => setCategory((now) => (now === from ? to : now))}
        onRemoved={(name) => setCategory((now) => (now === name ? "" : now))}
      />,
    );

  // `?categories=1` opens the categories sheet (settings links here); the address is cleared once handled.
  const pathname = usePathname();
  const categoriesParam = useSearchParams().get("categories");
  const handled = useRef(false);
  useEffect(() => {
    if (!categoriesParam) {
      handled.current = false;
      return;
    }
    if (handled.current) return;
    handled.current = true;
    openCategories();
    replaceAddress(pathname);
    // The sheet opens once per visit to the address; `openCategories` only reads state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesParam]);

  // Any change to what's in view starts again at the first page.
  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setShown(PAGE);
  };
  const clearAll = () => {
    setQuery("");
    setCategory("");
    setKeen(false);
    setShown(PAGE);
  };

  async function toggleKeen(vendor: VendorListItem, next: boolean) {
    setChanges((all) => ({ ...all, [vendor.id]: { keen: next, failed: false } }));
    try {
      await setVendorKeen(vendor.id, next);
    } catch {
      setChanges((all) => ({ ...all, [vendor.id]: { keen: next, failed: true } }));
      return;
    }
    setChanges((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== vendor.id)));
    toast.confirmation(keenToast(vendor.name, next));
  }

  function exportRows() {
    const named = [settings?.yourName, settings?.partnerName].filter((n): n is string => Boolean(n?.trim()));
    const fileName = exportFileName("vendors", named.length ? named : ["our", "wedding"]);
    downloadText(fileName, vendorsCsv(view.rows));
    toast.confirmation(exportedToast(view.rows.length, fileName));
  }

  const hero = (
    <Hero
      title="Vendors"
      sub={vendorsSub(vendors.length, keenCount(vendors))}
      nav={<SubNav set="vendors" current="/vendors" />}
    />
  );

  if (vendors.length === 0) {
    return (
      <>
        {hero}
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_YET.title}
          actions={<Btn onClick={openAdd}>Add a vendor</Btn>}
        >
          {NOTHING_YET.body}
        </Message>
      </>
    );
  }

  function row(vendor: VendorListItem, showCategory: boolean) {
    const change = changes[vendor.id];
    const keenNow = change?.keen ?? vendor.starred;
    const data: VendorRowData = {
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      contact: vendor.contactName,
      price: vendor.price,
      optionCount: vendor.optionCount,
      rating: vendor.bridestoryRating,
      reviewers: vendor.bridestoryReviewCount ?? 0,
      ruledOut: vendor.contractStatus === VENDOR_RULED_OUT,
    };
    return (
      <VendorRow
        key={vendor.id}
        vendor={data}
        href={veilHref(`/vendors/${vendor.id}`)}
        showCategory={showCategory}
        shortlistHref={vendor.finalistId ? veilHref(`/vendors/shortlist/${vendor.finalistId}`) : null}
        keen={<KeenHeart name={vendor.name} keen={keenNow} onToggle={(next) => void toggleKeen(vendor, next)} />}
        stage={<StageThread kind="vendor" stage={vendor.contractStatus} />}
        whatsApp={<WhatsAppLink phone={vendor.contactPhone} />}
        failed={
          change?.failed
            ? { message: offlineOr(keenFailed(vendor.name), offline), onRetry: () => void toggleKeen(vendor, change.keen) }
            : undefined
        }
      />
    );
  }

  const none = noResults({ query, category, keen });

  return (
    <>
      {hero}
      <FocusChips
        label="Focus on a category"
        value={category}
        chips={[
          { id: "", label: "All", count: n0(vendors.length) },
          ...vendorFocus(categories, vendors).map((c) => ({ id: c.name, label: c.name, count: n0(c.count) })),
        ]}
        onChoose={narrow(setCategory)}
        onEdit={openCategories}
      />
      <Toolbar tight>
        <SearchField
          label="Search vendors"
          placeholder="Search names, contacts and notes"
          value={query}
          onChange={narrow(setQuery)}
        />
        <Toggles>
          <FilterCheck label="Only ones we’re keen on" checked={keen} onChange={narrow(setKeen)} />
          <OrderBy choices={VENDOR_ORDERS} order={order} onChange={narrow(setOrder)} />
        </Toggles>
      </Toolbar>
      {filtering && (
        <FilterBar>
          <ShowEverything filtering label="Show every vendor" onClear={clearAll} />
        </FilterBar>
      )}

      {view.rows.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={none.title}
          actions={
            <>
              {query.trim() && (
                <Btn variant="quiet" onClick={() => setQuery("")}>
                  Clear the search
                </Btn>
              )}
              {(category || keen) && (
                <Btn variant="quiet" onClick={clearAll}>
                  Show every vendor
                </Btn>
              )}
            </>
          }
        >
          {none.body}
        </Message>
      ) : (
        <>
          <CountLine>
            {countText(view.rows.length, view.shown, filtering)}.{" "}
            <TextLink onClick={exportRows}>{exportLabel(view.rows.length === vendors.length)}</TextLink>
          </CountLine>
          {grouped ? (
            groupByCategory(view.rows, page).map((group) => (
              <div key={group.category}>
                <h2 className={styles.catHeading}>
                  <span dir="auto">{group.category}</span>
                  <span className={styles.catCount}>{countText(group.count, group.count, false)}</span>
                </h2>
                <Ledger>{group.rows.map((vendor) => row(vendor, false))}</Ledger>
              </div>
            ))
          ) : (
            <div className={styles.flat}>
              <Ledger label="Vendors">{page.map((vendor) => row(vendor, !category))}</Ledger>
            </div>
          )}
          <ShowMore more={view.more} onMore={() => setShown((count) => count + PAGE)} />
        </>
      )}

      <AddButton onPress={openAdd}>Add a vendor</AddButton>
    </>
  );
}
