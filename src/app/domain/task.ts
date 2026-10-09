import { isLocalDate, LocalDate } from "./local-date";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "pending" | "completed";

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly projectColor: string | null;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly plannedDate: LocalDate;
  readonly sortOrder: number;
  readonly estimatedMinutes: number | null;
  readonly actualMinutes: number | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isInherited: boolean;
}

export interface TaskDraft {
  readonly title: string;
  readonly description?: string | null;
  readonly projectId?: string | null;
  readonly priority?: TaskPriority;
  readonly plannedDate: LocalDate;
  readonly estimatedMinutes?: number | null;
  readonly actualMinutes?: number | null;
}

export interface NormalizedTaskDraft {
  readonly title: string;
  readonly description: string | null;
  readonly projectId: string | null;
  readonly priority: TaskPriority;
  readonly plannedDate: LocalDate;
  readonly estimatedMinutes: number | null;
  readonly actualMinutes: number | null;
}

export function normalizeTaskDraft(draft: TaskDraft): NormalizedTaskDraft {
  const title = draft.title.trim();
  if (!title) {
    throw new Error("El título es obligatorio");
  }

  if (!isLocalDate(draft.plannedDate)) {
    throw new Error("La fecha no es válida");
  }

  return {
    title,
    description: normalizeOptionalText(draft.description),
    projectId: normalizeOptionalText(draft.projectId),
    priority: draft.priority ?? "medium",
    plannedDate: draft.plannedDate,
    estimatedMinutes: normalizeDuration(draft.estimatedMinutes),
    actualMinutes: normalizeDuration(draft.actualMinutes),
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("La duración no puede ser negativa");
  }

  return value;
}
