"use client";

import { useBudgetOverview } from "@/lib/data/use-budget";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { BudgetView } from "./budget-view";

/**
 * The budget (guide §5.4, B5–B8, O2, S6). Loading, failed, offline and
 * demonstration mode come from the shared screen state; with data, the view
 * draws the hero, the next payment, the doors and the closing line.
 */
export function Budget() {
  const read = useBudgetOverview();
  const recordPayment = useRecordPayment();
  return (
    <PageColumn>
      <ScreenState read={read} what="the budget" onRetry={() => window.location.reload()}>
        {(data) => <BudgetView view={data} onRecord={recordPayment} />}
      </ScreenState>
    </PageColumn>
  );
}
