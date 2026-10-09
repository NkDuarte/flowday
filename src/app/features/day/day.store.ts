import { computed, Injectable, signal, WritableSignal } from "@angular/core";
import { Clock } from "../../domain/clock";
import { addLocalDays, LocalDate, toLocalDate } from "../../domain/local-date";
import { TaskRepository } from "../../domain/task-repository";
import { EMPTY_TASK_STATISTICS, TaskDailyTrend, TaskStatistics } from "../../domain/task-statistics";
import { normalizeTaskDraft, Task, TaskDraft } from "../../domain/task";

@Injectable()
export class DayStore {
  private readonly taskState = signal<readonly Task[]>([]);
  private loadSequence = 0;

  readonly selectedDate: WritableSignal<LocalDate>;
  readonly selectedProjectId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly tasks = this.taskState.asReadonly();
  readonly statistics = signal<TaskStatistics>(EMPTY_TASK_STATISTICS);
  readonly dailyTrend = signal<readonly TaskDailyTrend[]>([]);
  readonly activeTasks = computed(() => this.taskState().filter((task) => task.status === "pending"));
  readonly completedTasks = computed(() =>
    this.taskState().filter((task) => task.status === "completed"),
  );
  readonly isToday = computed(() => this.selectedDate() === toLocalDate(this.clock.now()));

  taskById(id: string): Task | null {
    return this.taskState().find((task) => task.id === id) ?? null;
  }

  constructor(
    private readonly repository: TaskRepository,
    private readonly clock: Clock,
  ) {
    this.selectedDate = signal(toLocalDate(this.clock.now()));
  }

  async initialize(): Promise<void> {
    const now = this.clock.now();
    const today = toLocalDate(now);
    this.selectedDate.set(today);
    await this.repository.rollover(today, now.toISOString());
    await this.load(today);
  }

  async load(date: LocalDate = this.selectedDate()): Promise<void> {
    const sequence = ++this.loadSequence;
    this.selectedDate.set(date);
    this.loading.set(true);
    this.error.set(null);
    const projectId = this.selectedProjectId();

    try {
      const [tasks, statistics, dailyTrend] = await Promise.all([
        this.repository.listForDate(date, projectId),
        this.repository.getStatistics(date, projectId),
        this.repository.getDailyTrend(date, projectId, 30),
      ]);
      if (sequence === this.loadSequence) {
        this.taskState.set(tasks);
        this.statistics.set(statistics);
        this.dailyTrend.set(dailyTrend);
      }
    } catch (error: unknown) {
      if (sequence === this.loadSequence) {
        this.error.set(errorMessage(error));
      }
      throw error;
    } finally {
      if (sequence === this.loadSequence) {
        this.loading.set(false);
      }
    }
  }

  async selectRelativeDay(amount: number): Promise<void> {
    await this.load(addLocalDays(this.selectedDate(), amount));
  }

  async selectToday(): Promise<void> {
    const now = this.clock.now();
    const today = toLocalDate(now);
    await this.repository.rollover(today, now.toISOString());
    await this.load(today);
  }

  async rolloverPendingTasks(): Promise<number> {
    const now = this.clock.now();
    const today = toLocalDate(now);
    const movedTaskCount = await this.repository.rollover(today, now.toISOString());
    if (movedTaskCount > 0 && this.selectedDate() === today) {
      await this.load(today);
    }
    return movedTaskCount;
  }

  async selectProject(projectId: string | null): Promise<void> {
    this.selectedProjectId.set(projectId);
    await this.load();
  }

  async createQuickTask(title: string): Promise<Task> {
    return this.createTask({
      title,
      plannedDate: this.selectedDate(),
      projectId: this.selectedProjectId(),
    });
  }

  async createTask(draft: TaskDraft): Promise<Task> {
    return this.save(async () => {
      const task = await this.repository.create(normalizeTaskDraft(draft));
      await this.load();
      return task;
    });
  }

  async updateTask(id: string, draft: TaskDraft): Promise<void> {
    await this.save(async () => {
      await this.repository.update(id, normalizeTaskDraft(draft));
      await this.load();
    });
  }

  async complete(id: string): Promise<void> {
    await this.save(async () => {
      await this.repository.complete(id, this.clock.now().toISOString());
      await this.load();
    });
  }

  async reopen(id: string): Promise<void> {
    await this.save(async () => {
      await this.repository.reopen(id, this.clock.now().toISOString());
      await this.load();
    });
  }

  async updateTimeTracking(id: string, actualMinutes: number | null, startedAt: string | null): Promise<void> {
    await this.save(async () => {
      await this.repository.updateTimeTracking(id, actualMinutes, startedAt, this.clock.now().toISOString());
      await this.load();
    });
  }

  async delete(id: string): Promise<void> {
    await this.save(async () => {
      await this.repository.delete(id);
      await this.load();
    });
  }

  async restoreTask(task: Task): Promise<void> {
    await this.save(async () => {
      await this.repository.restore(task);
      await this.load();
    });
  }

  async moveToDate(id: string, date: LocalDate): Promise<void> {
    await this.save(async () => {
      await this.repository.moveToDate(id, date, this.clock.now().toISOString());
      await this.load();
    });
  }

  async reorder(previousIndex: number, currentIndex: number): Promise<void> {
    if (previousIndex === currentIndex) {
      return;
    }

    const previousTasks = this.taskState();
    const activeTasks = [...this.activeTasks()];
    const [movedTask] = activeTasks.splice(previousIndex, 1);
    if (!movedTask) {
      return;
    }

    activeTasks.splice(currentIndex, 0, movedTask);
    this.taskState.set([...activeTasks, ...this.completedTasks()]);
    this.error.set(null);

    try {
      await this.repository.reorder(
        activeTasks.map((task) => task.id),
        this.clock.now().toISOString(),
      );
    } catch (error: unknown) {
      this.taskState.set(previousTasks);
      this.error.set(errorMessage(error));
      throw error;
    }
  }

  clearError(): void {
    this.error.set(null);
  }

  private async save<T>(operation: () => Promise<T>): Promise<T> {
    this.saving.set(true);
    this.error.set(null);

    try {
      return await operation();
    } catch (error: unknown) {
      this.error.set(errorMessage(error));
      throw error;
    } finally {
      this.saving.set(false);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No pudimos guardar los cambios";
}
