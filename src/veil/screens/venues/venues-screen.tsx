"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { bookingIdOf } from "@/lib/data/bookings";
import { useVenues } from "@/lib/data/venues";
import { n0, rp } from "@/lib/model/format";
import { VENUE_RULED_OUT } from "@/lib/model/labels";
import { readAmount } from "@/lib/model/amount";
import { VENUE_ORDERS, type VenueOrderKey } from "@/lib/model/order";
import { NO_VENUE_FILTER, isFilteringVenues, type VenueFilter } from "@/lib/model/search";
import {
  NOTHING_YET,
  NO_RESULTS_TITLE,
  bookedVenues,
  capacityOf,
  costOf,
  countText,
  noResultsBody,
  readGuestFilter,
  venueView,
  venuesSub,
  type VenueListItem,
} from "@/lib/model/venues";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { Ledger } from "@/veil/parts/rows/ledger";
import { VenueRow } from "@/veil/parts/rows/venue-row";
import { StageThread } from "@/veil/parts/stage/stage-thread";
import { ruledOutStage, stageLabel, stageSteps } from "@/veil/parts/stage/stage-text";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { FilterCheck, RangeField, ShowEverything } from "@/veil/parts/tools/filters";
import { SearchField } from "@/veil/parts/tools/search-field";
import { FilterSelect, OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { AddVenueSheet, EditVenueSheet } from "./venue-sheet";
import styles from "./venues-screen.module.css";

/** Venues shown at a time (guide §6.8). */
const PAGE = 60;

/** Venues (guide §5.15, F1, F3–F5, F22, B1). */
export function VenuesScreen() {
  const read = useVenues();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="the venues" onRetry={() => window.location.reload()}>
        {(data) => <VenuesList venues={data ?? []} ready={read.status === "ready"} />}
      </ScreenState>
    </PageColumn>
  );
}

const STAGE_OPTIONS = [
  { value: "", label: "Any" },
  ...stageSteps("venue").map((s) => ({ value: s.value, label: s.label })),
  { value: ruledOutStage("venue"), label: stageLabel("venue", ruledOutStage("venue")) },
];

function VenuesList({ venues, ready }: { venues: VenueListItem[]; ready: boolean }) {
  const sheets = useSheets();

  const [filter, setFilter] = useState<VenueFilter>(NO_VENUE_FILTER);
  const [order, setOrder] = useState<OrderState<VenueOrderKey>>({ key: "cost", direction: "asc" });
  const [shown, setShown] = useState(PAGE);

  const filtering = isFilteringVenues(filter);
  const view = venueView(venues, filter, order, shown, PAGE);
  const page = view.rows.slice(0, view.shown);
  const booked = bookedVenues(venues);

  const openAdd = () => sheets.open(<AddVenueSheet />);
  const openVenue = (id: string) => sheets.open(<EditVenueSheet venueId={id} />);

  // `?venue=<id>` opens that venue's sheet (the agenda and the overview link here); the address is cleared once handled.
  const router = useRouter();
  const pathname = usePathname();
  const venueParam = useSearchParams().get("venue");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!venueParam || !ready || handled.current === venueParam) return;
    handled.current = venueParam;
    if (venues.some((v) => v.id === venueParam)) sheets.open(<EditVenueSheet venueId={venueParam} />);
    router.replace(pathname);
  }, [venueParam, ready, venues, sheets, router, pathname]);

  // Any change to what's in view starts again at the first page.
  const narrow = (next: Partial<VenueFilter>) => {
    setFilter((now) => ({ ...now, ...next }));
    setShown(PAGE);
  };
  const clearAll = () => {
    setFilter({ ...NO_VENUE_FILTER, hideRuledOut: false });
    setShown(PAGE);
  };

  const sub =
    booked.length > 0 ? (
      <>
        Booked:{" "}
        {booked.map((v, index) => (
          <Fragment key={v.id}>
            {index > 0 ? ", " : ""}
            <TextLink href={veilHref(`/budget/bookings/${bookingIdOf({ kind: "venue", id: v.id })}`)}>{v.name}</TextLink>
          </Fragment>
        ))}
      </>
    ) : (
      venuesSub(venues.length)
    );

  const hero = <Hero title="Venues" sub={sub} nav={<SubNav set="vendors" current="/vendors/venues" />} />;

  if (venues.length === 0) {
    return (
      <>
        {hero}
        <Message kind="nothing-yet" inline title={NOTHING_YET.title} actions={<Btn onClick={openAdd}>Add a venue</Btn>}>
          {NOTHING_YET.body}
        </Message>
      </>
    );
  }

  return (
    <>
      {hero}
      <Toolbar>
        <SearchField
          label="Search venues"
          placeholder="Search names, places and notes"
          value={filter.query}
          onChange={(query) => narrow({ query })}
        />
        <Toggles>
          <OrderBy
            choices={VENUE_ORDERS}
            order={order}
            onChange={(next) => {
              setOrder(next);
              setShown(PAGE);
            }}
          />
        </Toggles>
      </Toolbar>
      <Toolbar continued>
        <FilterSelect
          label="Stage"
          value={filter.stage}
          options={STAGE_OPTIONS}
          // Asking for the ruled-out ones is asking to see them.
          onChange={(stage) => narrow(stage === VENUE_RULED_OUT ? { stage, hideRuledOut: false } : { stage })}
        />
        <RangeField
          label="Costs at most"
          value={filter.maxCost}
          read={readAmount}
          show={rp}
          onChange={(maxCost) => narrow({ maxCost })}
        />
        <RangeField
          label="Holds at least"
          unit="guests"
          value={filter.minGuests}
          read={readGuestFilter}
          show={n0}
          onChange={(minGuests) => narrow({ minGuests })}
        />
        <Toggles>
          <FilterCheck label="Hide ruled out" checked={filter.hideRuledOut} onChange={(hideRuledOut) => narrow({ hideRuledOut })} />
          <ShowEverything filtering={filtering} label="Show every venue" onClear={clearAll} />
        </Toggles>
      </Toolbar>

      {view.rows.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={NO_RESULTS_TITLE}
          actions={
            <Btn variant="quiet" onClick={clearAll}>
              Show every venue
            </Btn>
          }
        >
          {noResultsBody(filter)}
        </Message>
      ) : (
        <>
          <CountLine>{countText(view.rows.length, view.shown, filtering, view.hidden)}</CountLine>
          <div className={styles.list}>
            <Ledger label="Venues">
            {page.map((venue) => (
              <VenueRow
                key={venue.id}
                venue={{
                  id: venue.id,
                  name: venue.name,
                  cost: costOf(venue),
                  location: venue.location,
                  capacity: capacityOf(venue),
                  ruledOut: venue.status === VENUE_RULED_OUT,
                  fileCount: venue.fileCount,
                  notes: venue.notes,
                }}
                href={veilHref(`/vendors/venues?venue=${venue.id}`)}
                stage={<StageThread kind="venue" stage={venue.status} />}
                onOpen={() => openVenue(venue.id)}
              />
            ))}
            </Ledger>
          </div>
          <ShowMore more={view.more} onMore={() => setShown((count) => count + PAGE)} />
        </>
      )}

      <AddButton onPress={openAdd}>Add a venue</AddButton>
    </>
  );
}
