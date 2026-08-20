"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { EditableText } from "@/components/shared/editable-text";
import {
  addSubtask,
  createTodo,
  deleteSubtask,
  deleteTodo,
  updateSubtask,
  updateTodo,
  useTodos,
} from "@/lib/collections/todos";
import type { TodoItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function byDueDate(a: TodoItem, b: TodoItem) {
  return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
}

function TodoRow({ todo }: { todo: TodoItem }) {
  const [expanded, setExpanded] = useState(false);
  const doneSubtasks = todo.subtasks.filter((s) => s.done).length;

  return (
    <div className="rounded-lg border border-border/60">
      <div className="group flex items-center gap-3 px-2 py-2">
        <Checkbox
          checked={todo.done}
          onCheckedChange={(checked) => updateTodo(todo.id, { done: Boolean(checked) })}
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="flex-1">
          <EditableText
            value={todo.title}
            onSave={(title) => updateTodo(todo.id, { title })}
            className={cn("px-0", todo.done && "text-muted-foreground line-through")}
          />
        </div>
        {todo.subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneSubtasks}/{todo.subtasks.length} subtasks
          </span>
        )}
        <Input
          type="date"
          value={todo.dueDate ?? ""}
          onChange={(e) => updateTodo(todo.id, { dueDate: e.target.value || null })}
          className="h-8 w-36 border-none bg-transparent text-xs text-muted-foreground shadow-none"
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={() => deleteTodo(todo.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border/60 bg-accent/20 px-2 py-2 pl-9">
          <EditableText
            value={todo.notes}
            onSave={(notes) => updateTodo(todo.id, { notes })}
            placeholder="Add notes…"
            multiline
            className="text-xs"
          />

          <div className="flex flex-col gap-1">
            {todo.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="group/sub flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/40"
              >
                <Checkbox
                  checked={subtask.done}
                  onCheckedChange={(checked) =>
                    updateSubtask(todo, subtask.id, { done: Boolean(checked) })
                  }
                />
                <div className="flex-1">
                  <EditableText
                    value={subtask.title}
                    onSave={(title) => updateSubtask(todo, subtask.id, { title })}
                    className={cn(
                      "px-0 text-sm",
                      subtask.done && "text-muted-foreground line-through",
                    )}
                  />
                </div>
                <Input
                  type="date"
                  value={subtask.dueDate ?? ""}
                  onChange={(e) =>
                    updateSubtask(todo, subtask.id, { dueDate: e.target.value || null })
                  }
                  className="h-7 w-32 border-none bg-transparent text-xs text-muted-foreground shadow-none"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/sub:opacity-100"
                  onClick={() => deleteSubtask(todo, subtask.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-fit gap-1 text-xs text-muted-foreground"
            onClick={() => addSubtask(todo)}
          >
            <Plus className="size-3.5" />
            Add subtask
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TodoPage() {
  const { data: todos, loading } = useTodos();
  const [showArchived, setShowArchived] = useState(false);

  const active = todos.filter((t) => !t.done).sort(byDueDate);
  const archived = todos.filter((t) => t.done).sort((a, b) => byDueDate(b, a));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">To Do</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track tasks with subtasks. Completed tasks move to the archive.
          </p>
        </div>
        <Button className="gap-1" onClick={() => createTodo()}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-semibold">
              Active
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {active.length} task{active.length === 1 ? "" : "s"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {active.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No active tasks. Nice.</p>
            ) : (
              active.map((todo) => <TodoRow key={todo.id} todo={todo} />)
            )}
          </CardContent>
        </Card>
      )}

      {!loading && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader
            className="flex-row cursor-pointer items-center justify-between space-y-0"
            onClick={() => setShowArchived((s) => !s)}
          >
            <CardTitle className="flex items-center gap-2 font-heading text-lg font-semibold text-muted-foreground">
              {showArchived ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Archived
              <span className="text-sm font-normal">
                {archived.length} completed
              </span>
            </CardTitle>
          </CardHeader>
          {showArchived && (
            <CardContent className="flex flex-col gap-2">
              {archived.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nothing archived yet.
                </p>
              ) : (
                archived.map((todo) => <TodoRow key={todo.id} todo={todo} />)
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
