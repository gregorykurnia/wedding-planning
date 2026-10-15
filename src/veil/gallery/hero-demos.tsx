import { rp } from "@/lib/model/format";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";

/**
 * Task 3.1's section of the component gallery: the hero, kicker, figure, context
 * and thread in each variant, with fixed fake data. The e2e test in
 * tests/e2e/demo/veil-hero.spec.ts checks how they look at both widths.
 */
export function HeroDemos() {
  const price = 882_800_000;
  const paid = 473_150_000;
  const extra = 120_000_000;
  const paidShare = Math.round((paid / price) * 100);
  const committedShare = Math.round((price / (price + extra)) * 100);

  return (
    <>
      <h3>Still to pay, the budget</h3>
      <Hero title="Budget">
        <Kicker>Still to pay</Kicker>
        <Figure amount={price - paid} />
        <Context>
          of <b className="num">{rp(price)}</b> committed, with <b className="num">{rp(paid)}</b>{" "}
          already paid
        </Context>
        <Thread
          fill={paidShare}
          ends={[`${paidShare}% paid`, `${100 - paidShare}% to go`]}
          label={`${paidShare}% paid, ${100 - paidShare}% to go`}
        />
      </Hero>

      <h3>Late</h3>
      <Hero>
        <Kicker>Late, across 1 payment</Kicker>
        <Figure amount={55_500_000} tone="late" md />
        <Context>Due 3 days ago, to the florist.</Context>
      </Hero>

      <h3>Overpaid, with a category and a line under the title</h3>
      <Hero category="Florist" title="Blossom & Co." sub="Booked 2 March">
        <Kicker>Overpaid by</Kicker>
        <Figure amount={27_500_000 - 25_000_000} tone="over" md />
        <Context>
          <b className="num">{rp(27_500_000)}</b> paid against a price of{" "}
          <b className="num">{rp(25_000_000)}</b>. Check whether the price or a payment is wrong.
        </Context>
        <Thread
          fill={100}
          over
          ends={["100% paid", "overpaid"]}
          label="100% paid, overpaid"
        />
      </Hero>

      <h3>Paid in full</h3>
      <Hero>
        <Kicker>Paid in full</Kicker>
        <Figure amount={18_000_000} tone="settled" md />
        <Context>
          of <b className="num">{rp(18_000_000)}</b>, with <b className="num">{rp(18_000_000)}</b>{" "}
          paid
        </Context>
        <Thread fill={100} ends={["100% paid", "0% to go"]} label="100% paid, 0% to go" />
      </Hero>

      <h3>Long: over 13 digits, so the figure shrinks</h3>
      <Hero>
        <Kicker>Still to pay</Kicker>
        <Figure amount={98_765_432_109_876} />
      </Hero>

      <h3>What-if, a figure with no title</h3>
      <Hero>
        <Kicker>If you went ahead with everything here</Kicker>
        <Figure amount={price + extra} md />
        <Context>
          <b className="num">{rp(price)}</b> already committed, plus <b className="num">{rp(extra)}</b>{" "}
          in what-if items
        </Context>
        <Thread
          fill={committedShare}
          maybe
          dot={false}
          ends={["Committed", "What-if"]}
          label={`${committedShare}% committed, the rest what-if`}
        />
      </Hero>

      <h3>Small thread, for a funder or a task</h3>
      <Thread small fill={60} label="60% paid" />
    </>
  );
}
