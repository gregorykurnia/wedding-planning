import { describe, expect, it } from "vitest";
import {
  ALL_DONE,
  NO_TASKS,
  STEP_ADD_FAILED,
  addedToast,
  deleteConfirm,
  deletedToast,
  finishFailed,
  finishedToast,
  reopenedToast,
  tasksSub,
} from "@/veil/screens/tasks/tasks-text";

describe("the Tasks words", () => {
  it("counts what is open and done, and says what the screen is for before any task", () => {
    expect(tasksSub({ open: 5, done: 2 })).toBe("5 open, 2 done");
    expect(tasksSub({ open: 5, done: 0 })).toBe("5 open");
    expect(tasksSub({ open: 0, done: 3 })).toBe("0 open, 3 done");
    expect(tasksSub({ open: 1204, done: 1 })).toBe("1.204 open, 1 done");
    expect(tasksSub({ open: 0, done: 0 })).toBe("Big jobs, broken into steps");
  });

  it("has the empty and everything-done messages", () => {
    expect(NO_TASKS.title).toBe("No tasks yet");
    expect(NO_TASKS.body).toContain("Add the big jobs, like choosing the caterer");
    expect(ALL_DONE.title).toBe("Everything’s done");
    expect(ALL_DONE.body).toBe("Finished tasks are kept below in case you need one back.");
  });

  it("names the task in each toast", () => {
    expect(addedToast("Order the cake")).toBe("Added Order the cake");
    expect(finishedToast("Order the cake")).toBe("Finished Order the cake");
    expect(reopenedToast("Order the cake")).toBe("Reopened Order the cake");
    expect(deletedToast("Order the cake")).toBe("Deleted Order the cake");
  });

  it("asks before deleting, and says how many steps go with the task", () => {
    expect(deleteConfirm({ title: "Choose the rings", subtasks: [] })).toEqual({
      title: "Delete Choose the rings?",
      body: "You can undo for a few seconds.",
      action: "Delete task",
    });
    const withSteps = deleteConfirm({ title: "Choose the rings", subtasks: [{ id: "a", title: "", dueDate: null, done: false }] });
    expect(withSteps.body).toBe("Its 1 step goes with it. You can undo for a few seconds.");
  });

  it("words a tick or an added step that didn't land", () => {
    expect(finishFailed("Choose the rings", true)).toBe("Couldn’t finish “Choose the rings”. Nothing was changed.");
    expect(finishFailed("Choose the rings", false)).toBe("Couldn’t reopen “Choose the rings”. Nothing was changed.");
    expect(STEP_ADD_FAILED).toBe("Couldn’t add the step. Nothing was changed.");
  });
});
