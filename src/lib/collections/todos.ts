"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import {
  addElement,
  removeElement,
  updateElement,
  withElementIds,
  type Element,
} from "@/lib/data/array-ops";
import type { TodoItem, TodoSubtask } from "@/lib/types";

const COLLECTION = "todos";

function fromDoc(id: string, data: DocumentData): TodoItem {
  return {
    id,
    title: data.title ?? "",
    notes: data.notes ?? "",
    dueDate: data.dueDate ?? null,
    done: data.done === true,
    subtasks: withElementIds<TodoSubtask>(data.subtasks),
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useTodos() {
  return useCollection<TodoItem>(COLLECTION, fromDoc);
}

export function createTodo() {
  return addDocument(COLLECTION, {
    title: "New task",
    notes: "",
    dueDate: null,
    done: false,
    subtasks: [],
  });
}

export function updateTodo(id: string, data: Partial<TodoItem>) {
  const { id: _id, ...rest } = data as TodoItem;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteTodo(id: string) {
  return deleteDocument(COLLECTION, id);
}

function newSubtaskId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `subtask-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Steps change through transactions on the latest stored array, so a partner's
// edit to another step is never overwritten (src/lib/data/array-ops.ts).
type StoredSubtask = TodoSubtask & Element;

export function addSubtask(todo: TodoItem) {
  const subtask: TodoSubtask = {
    id: newSubtaskId(),
    title: "New subtask",
    notes: "",
    dueDate: null,
    done: false,
  };
  return addElement(COLLECTION, todo.id, "subtasks", subtask as StoredSubtask);
}

export function updateSubtask(
  todo: TodoItem,
  subtaskId: string,
  data: Partial<TodoSubtask>,
) {
  return updateElement<StoredSubtask>(COLLECTION, todo.id, "subtasks", subtaskId, data);
}

export function deleteSubtask(todo: TodoItem, subtaskId: string) {
  return removeElement(COLLECTION, todo.id, "subtasks", subtaskId);
}
