import type { BudgetOverview } from "@/lib/data/use-budget";
import type { Booking } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import { veilHref } from "@/veil/href";
import { Btn } from "@/veil/parts/actions/btn";
import { DaysLine } from "@/veil/parts/days/days-line";
import { Doors, type DoorItem } from "@/veil/parts/doors/doors";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { Thread } from "@/veil/parts/hero/thread";
import { AfterLine, NextCard } from "@/veil/parts/next-card/next-card";
import { AddButton } from "@/veil/shell/add-button";
import {
  ADD_BOOKING,
  doorSummaries,
  heroFigures,
  NOTHING_BODY,
  NOTHING_TITLE,
  TRY_WHAT_IF,
} from "./budget-text";

export interface BudgetViewProps {
  /** The screen's numbers, or null in demonstration mode, where nothing is booked. */
  view: BudgetOverview | null;
  /** Record payment for a booking, or for one of its parts. */
  onRecord: (booking: Booking, partId: string | null) => void;
}

/**
 * The budget (guide §5.4): the still-to-pay hero, the next payment and the one
 * after it, four doors and the closing line. Nothing booked, or demonstration
 * mode, shows the empty layout instead.
 */
export function BudgetView({ view, onRecord }: BudgetViewProps) {
  if (!view || view.budget.count === 0) return <NothingBooked view={view} />;
  return <Booked view={view} onRecord={onRecord} />;
}

function Booked({ view, onRecord }: { view: BudgetOverview; onRecord: BudgetViewProps["onRecord"] }) {
  const { today, budget, dues, funders, notAssignedLeft, whatIfCount, projectedTotal, weddingDate } = view;
  const [next, after] = dues;
  const figures = heroFigures(budget);
  const summary = doorSummaries({ budget, dues, today, funders, notAssignedLeft, whatIfCount, projectedTotal });
  const doors: DoorItem[] = [
    { id: "bookings", name: "Bookings", href: veilHref("/budget/bookings"), summary: summary.bookings },
    { id: "payments", name: "Payments due", href: veilHref("/budget/payments"), summary: summary.payments },
    { id: "who-pays", name: "Who pays", href: veilHref("/budget/who-pays"), summary: summary.whoPays },
    { id: "what-if", name: "What-if items", href: veilHref("/budget/what-if"), summary: summary.whatIf },
  ];
  return (
    <>
      <Hero title="Budget">
        <Kicker>{figures.kicker}</Kicker>
        <Figure amount={figures.amount} tone={figures.over ? "over" : undefined} />
        <Context>
          {figures.over ? (
            <>
              <b className="num">{rp(budget.paid)}</b> paid against <b className="num">{rp(budget.price)}</b>{" "}
              committed. Check the overpaid bookings.
            </>
          ) : (
            <>
              of <b className="num">{rp(budget.price)}</b> committed, with{" "}
              <b className="num">{rp(budget.paid)}</b> already paid
            </>
          )}
        </Context>
        <Thread fill={figures.pct} over={figures.over} ends={figures.ends} label={figures.label} />
      </Hero>
      <NextCard
        today={today}
        next={next ?? null}
        lateCount={dues.filter((d) => d.urgency === "late").length}
        funders={funders}
        onRecord={() => {
          if (next) onRecord(next.booking, next.part.id);
        }}
      />
      {after && <AfterLine due={after} today={today} />}
      <Doors doors={doors} />
      <DaysLine wedding={weddingDate} today={today} />
      <AddButton path="/budget/bookings/new">{ADD_BOOKING}</AddButton>
    </>
  );
}

/**
 * Nothing booked yet (guide §5.4). Without data (demonstration mode) there is
 * no what-if count either, so the quiet link is offered, and no days line.
 */
function NothingBooked({ view }: { view: BudgetOverview | null }) {
  const noWhatIf = (view?.whatIfCount ?? 0) === 0;
  return (
    <>
      <Hero title="Budget" />
      <Message
        kind="nothing-yet"
        inline
        title={NOTHING_TITLE}
        actions={
          <>
            <Btn href={veilHref("/budget/bookings/new")}>{ADD_BOOKING}</Btn>
            {noWhatIf && (
              <Btn variant="quiet" href={veilHref("/budget/what-if")}>
                {TRY_WHAT_IF}
              </Btn>
            )}
          </>
        }
      >
        {NOTHING_BODY}
      </Message>
      {view && <DaysLine wedding={view.weddingDate} today={view.today} />}
    </>
  );
}
