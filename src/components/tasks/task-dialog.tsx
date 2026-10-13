"use client";

import { Plus, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { useTasksContext } from "@/components/providers/tasks-provider";
import { selectCategories } from "@/lib/domain/categories";
import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/domain/constants";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils/datetime";
import { makeId } from "@/lib/utils/id";
import type { Priority, Subtask, Task, TaskDraft } from "@/lib/domain/types";

interface TaskDialogProps {
  open: boolean;
  task: Task | null;
  /** Prefilled due date used when creating a task (e.g. from the calendar). */
  initialDueAt?: string | null;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
}

export function TaskDialog({ open, task, initialDueAt = null, onClose, onSubmit }: TaskDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      description={task ? "Tweak the details and save." : "Capture it now, refine it later."}
    >
      {/* Keyed remount: the dialog body only mounts while open, so each open
          starts from a clean form seeded from the task being edited (or the
          date a new task was created from). */}
      <TaskForm
        key={task?.id ?? `new-${initialDueAt ?? ""}`}
        task={task}
        initialDueAt={initialDueAt}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

interface TaskFormProps {
  task: Task | null;
  initialDueAt: string | null;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
}

function TaskForm({ task, initialDueAt, onClose, onSubmit }: TaskFormProps) {
  const { deletedCategories } = useTasksContext();
  const titleFieldId = useId();
  const notesFieldId = useId();
  const dueFieldId = useId();
  const errorId = useId();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [due, setDue] = useState(toDateTimeLocal(task?.dueAt ?? initialDueAt ?? null));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [category, setCategory] = useState(task?.category ?? "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [draftSubtask, setDraftSubtask] = useState("");
  const [error, setError] = useState<string | null>(null);

  const editing = task !== null;
  // A deleted category must never be selectable again.
  const categoryOptions = selectCategories(deletedCategories);

  function addLocalSubtask(): void {
    const trimmed = draftSubtask.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [...prev, { id: makeId(8), title: trimmed, done: false }]);
    setDraftSubtask("");
  }

  function updateLocalSubtask(id: string, value: string): void {
    setSubtasks((prev) => prev.map((item) => (item.id === id ? { ...item, title: value } : item)));
  }

  function removeLocalSubtask(id: string): void {
    setSubtasks((prev) => prev.filter((item) => item.id !== id));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give your task a title.");
      return;
    }

    onSubmit({
      title: trimmed,
      description: description.trim(),
      dueAt: fromDateTimeLocal(due),
      priority,
      category: category || null,
      subtasks: subtasks
        .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
        .filter((subtask) => subtask.title.length > 0),
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <FieldLabel htmlFor={titleFieldId}>Title</FieldLabel>
        <Input
          id={titleFieldId}
          data-autofocus
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(null);
          }}
          placeholder="What needs doing?"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div>
        <FieldLabel htmlFor={notesFieldId}>Notes</FieldLabel>
        <Textarea
          id={notesFieldId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add any useful detail (optional)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={dueFieldId}>Due date</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id={dueFieldId}
              type="datetime-local"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              className="flex-1"
            />
            {due ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDue("")}
                aria-label="Clear due date"
                title="Clear due date"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
          <Select
            id="task-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {PRIORITY_ORDER.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_META[value].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="task-category">Category</FieldLabel>
        <Select id="task-category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">No category</option>
          {categoryOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <FieldLabel>Checklist</FieldLabel>
        {subtasks.length > 0 ? (
          <ul className="space-y-1.5">
            {subtasks.map((subtask, index) => (
              <li key={subtask.id} className="flex items-center gap-2">
                <Input
                  value={subtask.title}
                  onChange={(event) => updateLocalSubtask(subtask.id, event.target.value)}
                  aria-label={`Subtask ${index + 1}`}
                  className="h-9"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeLocalSubtask(subtask.id)}
                  aria-label={`Remove subtask ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={draftSubtask}
            onChange={(event) => setDraftSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLocalSubtask();
              }
            }}
            placeholder="Add a step…"
            aria-label="New checklist item"
            className="h-9"
          />
          <Button variant="secondary" size="sm" onClick={addLocalSubtask} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{editing ? "Save changes" : "Add task"}</Button>
      </div>
    </form>
  );
}
