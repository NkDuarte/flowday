import { LocalDate } from "./local-date";
import { NormalizedTaskDraft, Task, TaskPriority, TaskStatus } from "./task";
import { TaskDailyTrend, TaskStatistics } from "./task-statistics";

export interface TaskSearchFilters {
  readonly status: TaskStatus | null;
  readonly priority: TaskPriority | null;
  readonly projectId: string | null;
}

export abstract class TaskRepository {
  abstract listForDate(date: LocalDate, projectId?: string | null): Promise<readonly Task[]>;
  abstract listForSearch(filters: TaskSearchFilters): Promise<readonly Task[]>;
  abstract getStatistics(date: LocalDate, projectId?: string | null): Promise<TaskStatistics>;
  getDailyTrend(
    _date: LocalDate,
    _projectId: string | null = null,
    _rangeDays = 30,
  ): Promise<readonly TaskDailyTrend[]> {
    return Promise.resolve([]);
  }
  abstract create(draft: NormalizedTaskDraft): Promise<Task>;
  abstract update(id: string, draft: NormalizedTaskDraft): Promise<void>;
  abstract complete(id: string, completedAt: string): Promise<void>;
  abstract reopen(id: string, updatedAt: string): Promise<void>;
  abstract updateTimeTracking(
    id: string,
    actualMinutes: number | null,
    startedAt: string | null,
    updatedAt: string,
  ): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract restore(task: Task): Promise<void>;
  abstract reorder(ids: readonly string[], updatedAt: string): Promise<void>;
  abstract moveToDate(id: string, date: LocalDate, updatedAt: string): Promise<void>;
  abstract rollover(today: LocalDate, createdAt: string): Promise<number>;
}
