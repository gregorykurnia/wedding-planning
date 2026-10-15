"use client";

import { useCallback, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import type { ItemRecord } from "@/lib/model/items";
import { dropEdge, dropId, moveId, type DropEdge } from "@/lib/model/row-moves";
import { movedAnnouncement } from "./item-text";
import { ItemRow, type ItemActions } from "./item-row";
import styles from "./items.module.css";

export interface ItemListProps {
  /** The rows in the order shown. */
  items: readonly ItemRecord[];
  actions: ItemActions;
  /** Our own order with no sort or filter on. Otherwise there are no handles and nothing moves. */
  reorderable: boolean;
  /** The new order of every id, after a drag or Alt+↑/↓, and the one that moved. The screen writes it. */
  onReorder: (ids: string[], movedId: string) => void;
  failed?: { id: string; field: "name" | "vendor" } | null;
  demo?: boolean;
}

/**
 * The wedding items (guide §4.28). Drag a row by its handle: a rose line shows
 * where it will land, and the dragged row fades to 40%. Alt+↑/↓ on the handle
 * moves the row one place and keeps focus on its handle, and a screen reader
 * hears where it went. Nothing moves while a sort or filter is on.
 */
export function ItemList({ items, actions, reorderable, onReorder, failed = null, demo = false }: ItemListProps) {
  const list = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; edge: DropEdge } | null>(null);
  const [said, setSaid] = useState("");
  // After a move the row is in a new place in the document, which takes focus off its handle.
  const refocus = useRef<string | null>(null);

  const ids = items.map((i) => i.id);
  const idsKey = ids.join("\u0000");

  useLayoutEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    list.current?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"] [data-handle]`)?.focus();
  }, [idsKey]);

  const settle = useCallback(() => {
    setDrag(null);
    setOver(null);
  }, []);

  const moveByKey = (item: ItemRecord, by: -1 | 1) => {
    const next = moveId(ids, item.id, by);
    if (!next) return;
    refocus.current = item.id;
    setSaid(movedAnnouncement(item.item, next.indexOf(item.id) + 1, next.length));
    onReorder(next, item.id);
  };

  const handlersFor = (item: ItemRecord) => ({
    onDragStart: (event: DragEvent<HTMLLIElement>) => {
      // Dragging text inside a field selects it; only the row itself (grabbed by its handle or its edge) moves.
      if (event.target !== event.currentTarget) return event.preventDefault();
      event.dataTransfer.setData("text/plain", item.id);
      event.dataTransfer.effectAllowed = "move";
      setDrag(item.id);
    },
    onDragEnd: settle,
    onDragOver: (event: DragEvent<HTMLLIElement>) => {
      if (!drag || drag === item.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const box = event.currentTarget.getBoundingClientRect();
      const edge = dropEdge(event.clientY - box.top, box.height);
      setOver((current) => (current?.id === item.id && current.edge === edge ? current : { id: item.id, edge }));
    },
    onDragLeave: (event: DragEvent<HTMLLIElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOver((current) => (current?.id === item.id ? null : current));
      }
    },
    onDrop: (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const moved = drag ?? event.dataTransfer.getData("text/plain");
      const edge = over?.id === item.id ? over.edge : dropEdge(event.clientY - event.currentTarget.getBoundingClientRect().top, event.currentTarget.getBoundingClientRect().height);
      settle();
      const next = dropId(ids, moved, item.id, edge);
      if (next) onReorder(next, moved);
    },
  });

  return (
    <>
      <ul ref={list} className={styles.ilist}>
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            actions={actions}
            reorderable={reorderable}
            demo={demo}
            failedField={failed?.id === item.id ? failed.field : null}
            dragging={drag === item.id}
            dropEdge={over?.id === item.id ? over.edge : null}
            onMoveKey={moveByKey}
            dragHandlers={handlersFor(item)}
          />
        ))}
      </ul>
      <p className="sr" role="status" aria-live="polite">
        {said}
      </p>
    </>
  );
}
