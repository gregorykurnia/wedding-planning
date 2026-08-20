"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { TodoItem, TodoSubtask } from "@/lib/types";

const COLLECTION = "todos";

function fromDoc(id: string, data: DocumentData): TodoItem {
  return {
    id,
    title: data.title ?? "",
    notes: data.notes ?? "",
    dueDate: data.dueDate ?? null,
    done: data.done === true,
    subtasks: Array.isArray(data.subtasks) ? (data.subtasks as TodoSubtask[]) : [],
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

export function addSubtask(todo: TodoItem) {
  const subtask: TodoSubtask = {
    id: newSubtaskId(),
    title: "New subtask",
    notes: "",
    dueDate: null,
    done: false,
  };
  return updateTodo(todo.id, { subtasks: [...todo.subtasks, subtask] });
}

export function updateSubtask(
  todo: TodoItem,
  subtaskId: string,
  data: Partial<TodoSubtask>,
) {
  return updateTodo(todo.id, {
    subtasks: todo.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...data } : s)),
  });
}

export function deleteSubtask(todo: TodoItem, subtaskId: string) {
  return updateTodo(todo.id, {
    subtasks: todo.subtasks.filter((s) => s.id !== subtaskId),
  });
}
