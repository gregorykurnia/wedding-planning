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

export function useTodos(workspaceId: string | null) {
  return useCollection<TodoItem>(workspaceId, COLLECTION, fromDoc);
}

export function createTodo(workspaceId: string) {
  return addDocument(workspaceId, COLLECTION, {
    title: "New task",
    notes: "",
    dueDate: null,
    done: false,
    subtasks: [],
  });
}

export function updateTodo(workspaceId: string, id: string, data: Partial<TodoItem>) {
  const { id: _id, ...rest } = data as TodoItem;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteTodo(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}

function newSubtaskId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `subtask-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addSubtask(workspaceId: string, todo: TodoItem) {
  const subtask: TodoSubtask = {
    id: newSubtaskId(),
    title: "New subtask",
    notes: "",
    dueDate: null,
    done: false,
  };
  return updateTodo(workspaceId, todo.id, { subtasks: [...todo.subtasks, subtask] });
}

export function updateSubtask(
  workspaceId: string,
  todo: TodoItem,
  subtaskId: string,
  data: Partial<TodoSubtask>,
) {
  return updateTodo(workspaceId, todo.id, {
    subtasks: todo.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...data } : s)),
  });
}

export function deleteSubtask(workspaceId: string, todo: TodoItem, subtaskId: string) {
  return updateTodo(workspaceId, todo.id, {
    subtasks: todo.subtasks.filter((s) => s.id !== subtaskId),
  });
}
