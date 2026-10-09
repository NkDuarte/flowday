import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteTaskRepository } from "./sqlite-task.repository";

class FakeDatabase extends DatabaseGateway {
  readonly executions: Array<{ query: string; values: readonly unknown[] }> = [];
  readonly selections: Array<{ query: string; values: readonly unknown[] }> = [];
  selectResult: unknown = [];
  executeResult: DatabaseExecution = { rowsAffected: 0 };

  override async select<T>(query: string, bindValues: readonly unknown[] = []): Promise<T> {
    this.selections.push({ query, values: bindValues });
    return this.selectResult as T;
  }

  override async execute(
    query: string,
    bindValues: readonly unknown[] = [],
  ): Promise<DatabaseExecution> {
    this.executions.push({ query, values: bindValues });
    return this.executeResult;
  }
}

describe("SqliteTaskRepository", () => {
  let database: FakeDatabase;
  let repository: SqliteTaskRepository;

  beforeEach(() => {
    database = new FakeDatabase();
    repository = new SqliteTaskRepository(database);
  });

  it("maps persisted rows into domain tasks", async () => {
    database.selectResult = [
      {
        id: "task-1",
        title: "Revisar PR",
        description: null,
        project_id: "project-1",
        project_name: "Flowday",
        project_color: "#4B7A67",
        priority: "high",
        status: "pending",
        planned_date: "2026-08-17",
        sort_order: 100,
        estimated_minutes: 30,
        actual_minutes: null,
        started_at: null,
        completed_at: null,
        created_at: "2026-08-17T13:00:00.000Z",
        updated_at: "2026-08-17T13:00:00.000Z",
        is_inherited: 1,
      },
    ];

    const [task] = await repository.listForDate("2026-08-17");

    expect(task).toEqual(
      jasmine.objectContaining({
        id: "task-1",
        projectName: "Flowday",
        priority: "high",
        estimatedMinutes: 30,
        isInherited: true,
      }),
    );
  });

  it("orders pending tasks by priority before their manual order", async () => {
    await repository.listForDate("2026-08-17");

    const query = database.selections[0]?.query ?? "";

    expect(query).toContain("CASE t.priority");
    expect(query).toContain("WHEN 'high' THEN 0");
    expect(query).toContain("WHEN 'medium' THEN 1");
    expect(query).toContain("WHEN 'low' THEN 2");
    const priorityOrder = query.indexOf("CASE t.priority");
    expect(priorityOrder).toBeLessThan(query.indexOf("t.sort_order", priorityOrder));
  });

  it("filters global search by status, priority, and project", async () => {
    await repository.listForSearch({ status: "pending", priority: "high", projectId: "project-1" });

    const selection = database.selections[0];
    expect(selection?.query).toContain("t.status = $1");
    expect(selection?.query).toContain("t.priority = $2");
    expect(selection?.query).toContain("t.project_id = $3");
    expect(selection?.values).toEqual(["pending", "high", "project-1"]);
  });

  it("aggregates daily facts and trends without loading task rows", async () => {
    database.selectResult = [{
      daily_completed_count: 3,
      daily_actual_count: 2,
      daily_actual_minutes: 55,
      daily_missing_actual_count: 1,
      daily_comparable_count: 1,
      daily_comparable_estimated_minutes: 30,
      daily_comparable_actual_minutes: 25,
      inherited_task_count: 2,
      trend_7_completed_count: 8,
      trend_7_actual_count: 6,
      trend_7_actual_minutes: 190,
      trend_7_missing_actual_count: 2,
      trend_30_completed_count: 17,
      trend_30_actual_count: 11,
      trend_30_actual_minutes: 410,
      trend_30_missing_actual_count: 6,
    }];

    const statistics = await repository.getStatistics("2026-08-17", "project-1");

    const selection = database.selections[0];
    expect(selection?.query).toContain("date(completed_at, 'localtime')");
    expect(selection?.query).toContain("SUM(CASE WHEN completed_day >= $4");
    expect(selection?.values).toEqual(["2026-07-19", "2026-08-17", "project-1", "2026-08-11"]);
    expect(statistics).toEqual(jasmine.objectContaining({
      completedTaskCount: 3,
      actualMinutes: 55,
      completedWithoutActualMinutes: 1,
      inheritedTaskCount: 2,
      trend7Days: jasmine.objectContaining({ completedTaskCount: 8, actualMinutes: 190 }),
      trend30Days: jasmine.objectContaining({ completedTaskCount: 17, actualMinutes: 410 }),
    }));
  });

  it("loads a zero-filled daily trend for the selected range", async () => {
    database.selectResult = [{
      date: "2026-08-16",
      planned_task_count: 4,
      completed_task_count: 2,
      postponed_task_count: 1,
    }];

    const trend = await repository.getDailyTrend("2026-08-17", "project-1", 7);

    expect(database.selections[0]?.query).toContain("WITH RECURSIVE days");
    expect(database.selections[0]?.query).toContain("task_rollovers");
    expect(database.selections[0]?.values).toEqual(["2026-08-11", "2026-08-17", "project-1"]);
    expect(trend).toEqual([{
      date: "2026-08-16",
      plannedTaskCount: 4,
      completedTaskCount: 2,
      postponedTaskCount: 1,
    }]);
  });

  it("persists a complete order in one statement", async () => {
    await repository.reorder(
      ["second", "first"],
      "2026-08-17T13:00:00.000Z",
    );

    expect(database.executions.length).toBe(1);
    expect(database.executions[0].query).toContain("WITH ordering");
    expect(database.executions[0].values).toEqual([
      "second",
      100,
      "first",
      200,
      "2026-08-17T13:00:00.000Z",
    ]);
  });

  it("persists accumulated and active time separately", async () => {
    await repository.updateTimeTracking(
      "task-1",
      25,
      "2026-08-17T13:00:00.000Z",
      "2026-08-17T13:25:00.000Z",
    );

    expect(database.executions[0].query).toContain("started_at = $2");
    expect(database.executions[0].values).toEqual([
      25,
      "2026-08-17T13:00:00.000Z",
      "2026-08-17T13:25:00.000Z",
      "task-1",
    ]);
  });

  it("stops an active timer when completing a task", async () => {
    await repository.complete("task-1", "2026-08-17T13:25:00.000Z");

    expect(database.executions[0].query).toContain("started_at = NULL");
  });

  it("returns the number of tasks rolled forward", async () => {
    database.executeResult = { rowsAffected: 3 };

    const count = await repository.rollover(
      "2026-08-17",
      "2026-08-17T13:00:00.000Z",
    );

    expect(count).toBe(3);
  });
});
