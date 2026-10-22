"use client";

import { useState } from "react";
import { useFinalistsAndCategories } from "@/lib/data/shortlist";
import { buildCategories } from "@/lib/model/categories";
import { n0 } from "@/lib/model/format";
import { SHORTLIST_ORDERS, startDirection, type ShortlistOrderKey } from "@/lib/model/order";
import {
  NOTHING_ON_SHORTLIST,
  finalistCount,
  groupFinalists,
  shortlistFocus,
  shortlistSub,
  shortlistView,
  type FinalistListItem,
} from "@/lib/model/shortlist";
import { Btn } from "@/veil/parts/actions/btn";
import { FocusChips } from "@/veil/parts/chips/focus-chips";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { ShowMore } from "@/veil/parts/tools/results";
import { OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { AddFinalistSheet } from "./add-finalist-sheet";
import { FinalistCard } from "./finalist-card";
import styles from "./shortlist-screen.module.css";

/** Cards shown at a time (guide §6.8). */
const PAGE = 60;

/** The Shortlist (guide §5.13, F17–F19, F21). */
export function ShortlistScreen() {
  const read = useFinalistsAndCategories();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your shortlist" onRetry={() => window.location.reload()}>
        {(data) => <Shortlist finalists={data?.[0] ?? []} categories={data?.[1].list ?? buildCategories([])} />}
      </ScreenState>
    </PageColumn>
  );
}

function Shortlist({ finalists, categories }: { finalists: FinalistListItem[]; categories: string[] }) {
  const sheets = useSheets();
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState<OrderState<ShortlistOrderKey>>({
    key: "category",
    direction: startDirection(SHORTLIST_ORDERS, "category"),
  });
  const [shown, setShown] = useState(PAGE);

  const openAdd = () => sheets.open(<AddFinalistSheet category={category} />);

  const hero = (
    <Hero title="Shortlist" sub={shortlistSub(finalists)} nav={<SubNav set="vendors" current="/vendors/shortlist" />} />
  );

  if (finalists.length === 0) {
    return (
      <>
        {hero}
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_ON_SHORTLIST.title}
          actions={
            <>
              <Btn variant="quiet" href={veilHref("/vendors")}>
                Go to Vendors
              </Btn>
              <Btn onClick={openAdd}>Add a finalist</Btn>
            </>
          }
        >
          {NOTHING_ON_SHORTLIST.body}
        </Message>
      </>
    );
  }

  // A category that no finalist is in any more (the last one was removed) shows all of them.
  const focus = shortlistFocus(categories, finalists);
  const active = focus.some((c) => c.name === category) ? category : "";
  const view = shortlistView(finalists, { category: active }, order, categories, shown, PAGE);
  const page = view.rows.slice(0, view.shown);

  // Any change to what's in view starts again at the first page.
  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setShown(PAGE);
  };

  return (
    <>
      {hero}
      <FocusChips
        label="Focus on a category"
        value={active}
        chips={[
          { id: "", label: "All" },
          ...focus.map((c) => ({ id: c.name, label: c.name, count: n0(c.count) })),
        ]}
        onChoose={narrow(setCategory)}
      />
      <div className={styles.tools}>
        <OrderBy choices={SHORTLIST_ORDERS} order={order} onChange={narrow(setOrder)} />
      </div>

      {order.key === "category" ? (
        groupFinalists(view.rows, page).map((group) => (
          <div key={group.category}>
            <h2 className={styles.catHeading}>
              <span dir="auto">{group.category}</span>
              <span className={styles.catCount}>{finalistCount(group.count)}</span>
            </h2>
            <ul className={styles.grid}>
              {group.rows.map((f) => (
                <FinalistCard key={f.id} finalist={f} />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className={`${styles.grid} ${styles.flat}`}>
          {page.map((f) => (
            <FinalistCard key={f.id} finalist={f} />
          ))}
        </ul>
      )}
      <ShowMore more={view.more} onMore={() => setShown((count) => count + PAGE)} />

      <AddButton onPress={openAdd}>Add a finalist</AddButton>
    </>
  );
}
