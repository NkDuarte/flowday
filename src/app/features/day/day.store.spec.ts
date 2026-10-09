import { Clock } from "../../domain/clock";
import { LocalDate } from "../../domain/local-date";
import { TaskRepository, TaskSearchFilters } from "../../domain/task-repository";
import { EMPTY_TASK_STATISTICS, TaskStatistics } from "../../domain/task-statistics";
import { NormalizedTaskDraft, Task } from "../../domain/task";
import { DayStore } from "./day.store";

class FixedClock extends Clock {
  override now(): Date {
    return new Date(2026, 7, 17, 8);
  }
}

class FakeTaskRepository extends TaskRepository {
  readonly calls: string[] = [];
  tasks: Task[] = [];
  rolloverResult = 0;

  override async listForDate(date: LocalDate, projectId: string | null = null): Promise<readonly Task[]> {
    this.calls.push(`list:${date}:${projectId ?? "all"}`);
    return this.tasks;
  }

  override async listForSearch(_filters: TaskSearchFilters): Promise<readonly Task[]> {
    return this.tasks;
  }

  override async getStatistics(_date: LocalDate, _projectId: string | null = null): Promise<TaskStatistics> {
    return EMPTY_TASK_STATISTICS;
  }

  override async create(draft: NormalizedTaskDraft): Promise<Task> {
    this.calls.push(`create:${draft.title}:${draft.plannedDate}:${draft.projectId ?? "none"}`);
    const task = makeTask({ title: draft.title, plannedDate: draft.plannedDate });
    this.tasks = [...this.tasks, task];
    return task;
  }

  override async update(id: string, draft: NormalizedTaskDraft): Promise<void> {
    this.calls.push(`update:${id}:${draft.plannedDate}:${draft.description ?? "none"}`);
  }

  override async complete(id: string): Promise<void> {
    this.calls.push(`complete:${id}`);
  }

  override async reopen(): Promise<void> {}

  override async updateTimeTracking(
    id: string,
    actualMinutes: number | null,
    startedAt: string | null,
  ): Promise<void> {
    this.calls.push(`track:${id}:${actualMinutes ?? "none"}:${startedAt ?? "stopped"}`);
  }

  override async delete(id: string): Promise<void> {
    this.calls.push(`delete:${id}`);
  }

  override async restore(task: Task): Promise<void> {
    this.calls.push(`restore:${task.id}`);
  }

  override async reorder(ids: readonly string[]): Promise<void> {
    this.calls.push(`reorder:${ids.join(",")}`);
  }

  override async moveToDate(): Promise<void> {}

  override async rollover(today: LocalDate): Promise<number> {
    this.calls.push(`rollover:${today}`);
    return this.rolloverResult;
  }
}

describe("DayStore", () => {
  let repository: FakeTaskRepository;
  let store: DayStore;

  beforeEach(() => {
    repository = new FakeTaskRepository();
    store = new DayStore(repository, new FixedClock());
  });

  it("rolls pending work forward before loading today", async () => {
    await store.initialize();

    expect(store.selectedDate()).toBe("2026-08-17");
    expect(repository.calls).toEqual(["rollover:2026-08-17", "list:2026-08-17:all"]);
  });

  it("rechecks rollover on focus without leaving the selected past day", async () => {
    await store.initialize();
    await store.selectRelativeDay(-1);
    repository.rolloverResult = 2;

    const movedTaskCount = await store.rolloverPendingTasks();

    expect(movedTaskCount).toBe(2);
    expect(store.selectedDate()).toBe("2026-08-16");
    expect(repository.calls.filter((call) => call === "list:2026-08-16:all").length).toBe(1);
  });

  it("creates a quick task on the selected day", async () => {
    await store.initialize();
    await store.createQuickTask("  Revisar PR  ");

    expect(repository.calls).toContain("create:Revisar PR:2026-08-17:none");
    expect(store.activeTasks().map((task) => task.title)).toEqual(["Revisar PR"]);
  });

  it("persists the visible order", async () => {
    repository.tasks = [makeTask({ id: "first" }), makeTask({ id: "second" })];
    await store.initialize();
    await store.reorder(0, 1);

    expect(store.activeTasks().map((task) => task.id)).toEqual(["second", "first"]);
    expect(repository.calls).toContain("reorder:second,first");
  });

  it("loads a project folder and assigns quick tasks to it", async () => {
    await store.initialize();
    await store.selectProject("project-1");
    await store.createQuickTask("Preparar propuesta");

    expect(repository.calls).toContain("list:2026-08-17:project-1");
    expect(repository.calls).toContain("create:Preparar propuesta:2026-08-17:project-1");
  });

  it("updates the task description and planned date", async () => {
    await store.initialize();
    await store.updateTask("task-1", {
      title: "Preparar propuesta",
      description: "Incluir alcance y presupuesto",
      plannedDate: "2026-08-20",
    });

    expect(repository.calls).toContain(
      "update:task-1:2026-08-20:Incluir alcance y presupuesto",
    );
  });

  it("persists the task time-tracking state", async () => {
    await store.initialize();
    await store.updateTimeTracking("task-1", 25, "2026-08-17T13:00:00.000Z");

    expect(repository.calls).toContain("track:task-1:25:2026-08-17T13:00:00.000Z");
  });
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Task",
    description: null,
    projectId: null,
    projectName: null,
    projectColor: null,
    priority: "medium",
    status: "pending",
    plannedDate: "2026-08-17",
    sortOrder: 100,
    estimatedMinutes: null,
    actualMinutes: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-08-17T13:00:00.000Z",
    updatedAt: "2026-08-17T13:00:00.000Z",
    isInherited: false,
    ...overrides,
  };
}
