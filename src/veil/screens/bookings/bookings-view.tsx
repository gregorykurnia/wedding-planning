"use client";

import { useRef, useState } from "react";
import type { BookingList } from "@/lib/data/use-booking-list";
import type { FunderId } from "@/lib/model/bookings";
import { plural, rp } from "@/lib/model/format";
import { BOOKING_ORDERS, orderBookings, paging, type BookingOrderKey } from "@/lib/model/order";
import { bookingMatches } from "@/lib/model/search";
import { Btn } from "@/veil/parts/actions/btn";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { BookingEntry } from "@/veil/parts/rows/booking-entry";
import { Ledger } from "@/veil/parts/rows/ledger";
import { funderName } from "@/veil/parts/rows/ledger-text";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { BackLink } from "@/veil/shell/back-link";
import {
  ADD_BOOKING,
  CLEAR_SEARCH,
  countText,
  NO_RESULTS_BODY,
  noResultsTitle,
  NOTHING_BODY,
  NOTHING_SUB,
  NOTHING_TITLE,
  SEARCH_BOOKINGS,
} from "./bookings-text";

/** Bookings shown at a time (guide §6.8). */
const PAGE = 100;

export interface BookingsViewProps {
  /** The bookings, or null in demonstration mode, where nothing is booked. */
  list: BookingList | null;
  /** The search the screen opened with, from `?q=`. */
  initialQuery: string;
}

/**
 * The bookings (guide §5.5): a search, nine orders, and the ledger 100 at a time
 * with each booking's parts collapsed under it. Nothing booked, or demonstration
 * mode, shows the empty layout instead.
 */
export function BookingsView({ list, initialQuery }: BookingsViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState<OrderState<BookingOrderKey>>({ key: "due", direction: "asc" });
  const [shown, setShown] = useState(PAGE);
  const searchField = useRef<HTMLInputElement>(null);

  if (!list || list.bookings.length === 0) {
    return (
      <>
        <BackLink path="/budget" label="Budget" />
        <Hero title="Bookings" sub={NOTHING_SUB} />
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_TITLE}
          actions={<Btn href={veilHref("/budget/bookings/new")}>{ADD_BOOKING}</Btn>}
        >
          {NOTHING_BODY}
        </Message>
      </>
    );
  }

  const { today, funders } = list;
  const name = (id: FunderId) => funderName(funders, id);
  const found = orderBookings(
    list.bookings.filter((booking) => bookingMatches(booking, query, name)),
    order.key,
    order.direction,
    name,
  );
  const { visible, more } = paging(found.length, shown, PAGE);
  const rows = found.slice(0, visible);
  const countLine = countText(query, found.length, visible);

  // A new search or order starts again at the first page.
  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setShown(PAGE);
  };
  const clearSearch = () => {
    setQuery("");
    setShown(PAGE);
    searchField.current?.focus();
  };

  return (
    <>
      <BackLink path="/budget" label="Budget" />
      <Hero
        title="Bookings"
        sub={
          <>
            {plural(list.committed.count, "booking")}, <span className="num">{rp(list.committed.price)}</span>{" "}
            committed
          </>
        }
      />
      <Toolbar>
        <SearchField
          label={SEARCH_BOOKINGS}
          placeholder={SEARCH_BOOKINGS}
          value={query}
          onChange={narrow(setQuery)}
          inputRef={searchField}
        />
        <Toggles>
          <OrderBy choices={BOOKING_ORDERS} order={order} onChange={narrow(setOrder)} />
        </Toggles>
      </Toolbar>

      {found.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={noResultsTitle(query)}
          actions={
            <Btn variant="quiet" onClick={clearSearch}>
              {CLEAR_SEARCH}
            </Btn>
          }
        >
          {NO_RESULTS_BODY}
        </Message>
      ) : (
        <>
          {countLine && <CountLine>{countLine}</CountLine>}
          <Ledger label="Bookings">
            {rows.map((booking) => (
              <BookingEntry key={booking.id} booking={booking} funders={funders} today={today} />
            ))}
          </Ledger>
          <ShowMore more={more} onMore={() => setShown((size) => size + PAGE)} />
        </>
      )}
      <AddButton path="/budget/bookings/new">{ADD_BOOKING}</AddButton>
    </>
  );
}
