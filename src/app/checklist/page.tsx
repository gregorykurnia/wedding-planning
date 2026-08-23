"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/shared/editable-text";
import {
  createChecklistItem,
  deleteChecklistItem,
  updateChecklistItem,
  useChecklistItems,
} from "@/lib/collections/checklist-items";
import type { ChecklistPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASES: ChecklistPhase[] = [
  "12 Months Out",
  "6 Months Out",
  "1 Month Out",
  "Week Of",
];

export default function ChecklistPage() {
  const { data: items, loading } = useChecklistItems();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-foreground">Checklist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything to do, organized by how close the wedding is.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {PHASES.map((phase) => {
            const phaseItems = items
              .filter((item) => item.phase === phase)
              .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
            const doneCount = phaseItems.filter((i) => i.done).length;

            return (
              <Card key={phase} className="border-border/70 shadow-sm">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-heading text-lg font-semibold">
                    {phase}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {doneCount}/{phaseItems.length} done
                    </span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-muted-foreground"
                    onClick={() => createChecklistItem(phase)}
                  >
                    <Plus className="size-3.5" />
                    Add task
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                  {phaseItems.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No tasks yet.</p>
                  ) : (
                    phaseItems.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/40"
                      >
                        <Checkbox
                          checked={item.done}
                          onCheckedChange={(checked) =>
                            updateChecklistItem(item.id, { done: Boolean(checked) })
                          }
                        />
                        <div className="flex-1">
                          <EditableText
                            value={item.title}
                            onSave={(title) => updateChecklistItem(item.id, { title })}
                            className={cn(
                              "px-0",
                              item.done && "text-muted-foreground line-through",
                            )}
                          />
                        </div>
                        <Input
                          type="date"
                          value={item.dueDate ?? ""}
                          onChange={(e) =>
                            updateChecklistItem(item.id, { dueDate: e.target.value || null })
                          }
                          className="h-8 w-36 border-none bg-transparent text-xs text-muted-foreground shadow-none"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          onClick={() => deleteChecklistItem(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
