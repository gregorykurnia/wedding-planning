"use client";

import { useState } from "react";
import type { WhatIfDoc } from "@/lib/data/adapters/what-if";
import { removeWhatIf } from "@/lib/data/bookings";
import { useWhatIfPage, type WhatIfPage } from "@/lib/data/what-if";
import { rp } from "@/lib/model/format";
import { whatIfTotal } from "@/lib/model/money";
import { WHAT_IF_ORDERS, type WhatIfOrderKey } from "@/lib/model/order";
import {
  ADD_ACTION,
  CARRY_HEADING,
  KICKER,
  NOTHING_YET,
  REMOVE_ACTION,
  THREAD_ENDS,
  WHAT_IF_PAGE,
  carryRows,
  itemsSmall,
  projection,
  removeBody,
  removeTitle,
  removedToast,
  whatIfView,
} from "@/lib/model/what-if";
import { Btn } from "@/veil/parts/actions/btn";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";
import { CarryLines } from "@/veil/parts/menu-card/carry-lines";
import { Message } from "@/veil/parts/message/message";
import { Ledger } from "@/veil/parts/rows/ledger";
import { WhatIfEntry } from "@/veil/parts/rows/what-if-entry";
import { ShowMore } from "@/veil/parts/tools/results";
import { OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { Toggles } from "@/veil/parts/tools/toolbar";
import { AddButton } from "@/veil/shell/add-button";
import { BackLink } from "@/veil/shell/back-link";
import { useConfirm } from "@/veil/shell/confirm";
import { useFlasher } from "@/veil/shell/flash";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { AddWhatIfSheet, EditWhatIfSheet } from "./what-if-sheet";
import styles from "./what-if-screen.module.css";

/**
 * What-if items (guide §5.10, B8–B10): the projected total with its thread, who
 * would pay the extra, and the items. Loading, failed, offline and demonstration
 * mode come from the shared screen state; in demonstration mode there are no items
 * and the add sheet opens with its button off.
 */
export function WhatIfScreen() {
  const read = useWhatIfPage();
  return (
    <PageColumn>
      <ScreenState read={read} what="your what-if items" onRetry={() => window.location.reload()}>
        {(page) => <WhatIfList page={page} />}
      </ScreenState>
    </PageColumn>
  );
}

function WhatIfList({ page }: { page: WhatIfPage | null }) {
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const flash = useFlasher();

  const [order, setOrder] = useState<OrderState<WhatIfOrderKey>>({ key: "added", direction: "asc" });
  const [shown, setShown] = useState(WHAT_IF_PAGE);

  const openAdd = () => sheets.open(<AddWhatIfSheet />);
  const openItem = (item: { id: string }) => sheets.open(<EditWhatIfSheet itemId={item.id} />);

  async function remove(item: WhatIfDoc) {
    const removed: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: removeTitle(item.name),
      body: removeBody(whatIfTotal(item)),
      action: REMOVE_ACTION,
      danger: true,
      run: async () => {
        removed.undo = (await removeWhatIf(item.id)).undo;
      },
    });
    if (!done || !removed.undo) return;
    const undo = removed.undo;
    toast.undoable(removedToast(item.name), async () => {
      await undo();
      flash({ kind: "whatif", id: item.id });
    });
  }

  const back = <BackLink path="/budget" label="Budget" />;

  if (!page || page.items.length === 0) {
    return (
      <>
        {back}
        <Hero title="What-if items" />
        <Message kind="nothing-yet" inline title={NOTHING_YET.title} actions={<Btn onClick={openAdd}>{ADD_ACTION}</Btn>}>
          {NOTHING_YET.body}
        </Message>
      </>
    );
  }

  const { items, funders, committed } = page;
  const view = whatIfView(items, funders, order, shown, WHAT_IF_PAGE);
  const rows = view.rows.slice(0, view.shown);
  const extra = items.reduce((sum, item) => sum + whatIfTotal(item), 0);
  const total = projection(committed, extra);
  const carry = carryRows(items, funders);

  return (
    <>
      {back}
      <h1 className="sr">What-if items</h1>
      <Hero>
        <Kicker>{KICKER}</Kicker>
        <Figure md amount={total.total} />
        <Context>
          <b className="num">{rp(total.committed)}</b> already committed, plus <b className="num">{rp(total.whatIf)}</b> in
          what-if items
        </Context>
        <Thread fill={total.share} maybe dot={false} ends={THREAD_ENDS} label={total.label} />
      </Hero>

      <h2 className={styles.section}>{CARRY_HEADING}</h2>
      <CarryLines rows={carry.rows} more={carry.more} />

      <h2 className={styles.section}>
        <span>Items</span>
        <small>{itemsSmall(items.length)}</small>
      </h2>
      <div className={styles.order}>
        <Toggles>
          <OrderBy
            choices={WHAT_IF_ORDERS}
            order={order}
            onChange={(next) => {
              setOrder(next);
              setShown(WHAT_IF_PAGE);
            }}
          />
        </Toggles>
      </div>
      <Ledger label="What-if items">
        {rows.map((item) => (
          <WhatIfEntry key={item.id} item={item} funders={funders} onEdit={openItem} onRemove={() => void remove(item)} />
        ))}
      </Ledger>
      <ShowMore more={view.more} onMore={() => setShown((count) => count + WHAT_IF_PAGE)} />

      <AddButton onPress={openAdd}>{ADD_ACTION}</AddButton>
    </>
  );
}
