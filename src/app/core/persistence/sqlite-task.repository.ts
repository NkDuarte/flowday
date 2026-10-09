import { Injectable } from "@angular/core";
import { addLocalDays, LocalDate } from "../../domain/local-date";
import { TaskRepository, TaskSearchFilters } from "../../domain/task-repository";
import { EMPTY_TASK_STATISTICS, TaskDailyTrend, TaskStatistics } from "../../domain/task-statistics";
import {
  NormalizedTaskDraft,
  Task,
  TaskPriority,
  TaskStatus,
} from "../../domain/task";
import { DatabaseGateway } from "./database.gateway";

interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly project_id: string | null;
  readonly project_name: string | null;
  readonly project_color: string | null;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly planned_date: LocalDate;
  readonly sort_order: number;
  readonly estimated_minutes: number | null;
  readonly actual_minutes: number | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly is_inherited: number;
}

interface TaskStatisticsRow {
  readonly daily_completed_count: number;
  readonly daily_actual_count: number;
  readonly daily_actual_minutes: number;
  readonly daily_missing_actual_count: number;
  readonly daily_comparable_count: number;
  readonly daily_comparable_estimated_minutes: number;
  readonly daily_comparable_actual_minutes: number;
  readonly inherited_task_count: number;
  readonly trend_7_completed_count: number;
  readonly trend_7_actual_count: number;
  readonly trend_7_actual_minutes: number;
  readonly trend_7_missing_actual_count: number;
  readonly trend_30_completed_count: number;
  readonly trend_30_actual_count: number;
  readonly trend_30_actual_minutes: number;
  readonly trend_30_missing_actual_count: number;
}

interface TaskDailyTrendRow {
  readonly date: LocalDate;
  readonly planned_task_count: number;
  readonly completed_task_count: number;
  readonly postponed_task_count: number;
}

const TASK_COLUMNS = `
  t.id,
  t.title,
  t.description,
  t.project_id,
  p.name AS project_name,
  p.color AS project_color,
  t.priority,
  t.status,
  t.planned_date,
  t.sort_order,
  t.estimated_minutes,
  t.actual_minutes,
  t.started_at,
  t.completed_at,
  t.created_at,
  t.updated_at,
  EXISTS (
    SELECT 1
    FROM task_rollovers r
    WHERE r.task_id = t.id AND r.to_date = t.planned_date
  ) AS is_inherited
`;

@Injectable()
export class SqliteTaskRepository extends TaskRepository {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async listForDate(
    date: LocalDate,
    projectId: string | null = null,
  ): Promise<readonly Task[]> {
    const rows = await this.database.select<TaskRow[]>(
      `SELECT ${TASK_COLUMNS}
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.planned_date = $1
         AND ($2 IS NULL OR t.project_id = $2)
       ORDER BY
         CASE t.status WHEN 'pending' THEN 0 ELSE 1 END,
         CASE t.priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END,
         CASE WHEN t.status = 'pending' THEN t.sort_order END ASC,
         t.completed_at DESC`,
      [date, projectId],
    );

    return rows.map(mapTask);
  }

  override async listForSearch(filters: TaskSearchFilters): Promise<readonly Task[]> {
    const rows = await this.database.select<TaskRow[]>(
      `SELECT ${TASK_COLUMNS}
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE ($1 IS NULL OR t.status = $1)
         AND ($2 IS NULL OR t.priority = $2)
         AND ($3 IS NULL OR t.project_id = $3)
       ORDER BY t.planned_date DESC,
         CASE t.status WHEN 'pending' THEN 0 ELSE 1 END,
         CASE t.priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END,
         t.sort_order ASC,
         t.completed_at DESC`,
      [filters.status, filters.priority, filters.projectId],
    );

    return rows.map(mapTask);
  }

  override async getStatistics(
    date: LocalDate,
    projectId: string | null = null,
  ): Promise<TaskStatistics> {
    const start30Days = addLocalDays(date, -29);
    const start7Days = addLocalDays(date, -6);
    const rows = await this.database.select<TaskStatisticsRow[]>(
      `WITH completed_tasks AS MATERIALIZED (
         SELECT
           estimated_minutes,
           actual_minutes,
           date(completed_at, 'localtime') AS completed_day
         FROM tasks
         WHERE status = 'completed'
           AND completed_at IS NOT NULL
           AND date(completed_at, 'localtime') BETWEEN $1 AND $2
           AND ($3 IS NULL OR project_id = $3)
       ),
       inherited_tasks AS MATERIALIZED (
         SELECT r.task_id
         FROM task_rollovers r
         JOIN tasks t ON t.id = r.task_id
         WHERE r.to_date = $2
           AND ($3 IS NULL OR t.project_id = $3)
       )
       SELECT
         COALESCE(SUM(CASE WHEN completed_day = $2 THEN 1 ELSE 0 END), 0) AS daily_completed_count,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND actual_minutes IS NOT NULL THEN 1 ELSE 0 END), 0) AS daily_actual_count,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND actual_minutes IS NOT NULL THEN actual_minutes ELSE 0 END), 0) AS daily_actual_minutes,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND actual_minutes IS NULL THEN 1 ELSE 0 END), 0) AS daily_missing_actual_count,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND estimated_minutes IS NOT NULL AND actual_minutes IS NOT NULL THEN 1 ELSE 0 END), 0) AS daily_comparable_count,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND estimated_minutes IS NOT NULL AND actual_minutes IS NOT NULL THEN estimated_minutes ELSE 0 END), 0) AS daily_comparable_estimated_minutes,
         COALESCE(SUM(CASE WHEN completed_day = $2 AND estimated_minutes IS NOT NULL AND actual_minutes IS NOT NULL THEN actual_minutes ELSE 0 END), 0) AS daily_comparable_actual_minutes,
         (SELECT COUNT(*) FROM inherited_tasks) AS inherited_task_count,
         COALESCE(SUM(CASE WHEN completed_day >= $4 THEN 1 ELSE 0 END), 0) AS trend_7_completed_count,
         COALESCE(SUM(CASE WHEN completed_day >= $4 AND actual_minutes IS NOT NULL THEN 1 ELSE 0 END), 0) AS trend_7_actual_count,
         COALESCE(SUM(CASE WHEN completed_day >= $4 AND actual_minutes IS NOT NULL THEN actual_minutes ELSE 0 END), 0) AS trend_7_actual_minutes,
         COALESCE(SUM(CASE WHEN completed_day >= $4 AND actual_minutes IS NULL THEN 1 ELSE 0 END), 0) AS trend_7_missing_actual_count,
         COALESCE(COUNT(*), 0) AS trend_30_completed_count,
         COALESCE(SUM(CASE WHEN actual_minutes IS NOT NULL THEN 1 ELSE 0 END), 0) AS trend_30_actual_count,
         COALESCE(SUM(CASE WHEN actual_minutes IS NOT NULL THEN actual_minutes ELSE 0 END), 0) AS trend_30_actual_minutes,
         COALESCE(SUM(CASE WHEN actual_minutes IS NULL THEN 1 ELSE 0 END), 0) AS trend_30_missing_actual_count
       FROM completed_tasks`,
      [start30Days, date, projectId, start7Days],
    );

    return rows[0] ? mapTaskStatistics(rows[0]) : EMPTY_TASK_STATISTICS;
  }

  override async getDailyTrend(
    date: LocalDate,
    projectId: string | null = null,
    rangeDays = 30,
  ): Promise<readonly TaskDailyTrend[]> {
    const startDate = addLocalDays(date, -(rangeDays - 1));
    const rows = await this.database.select<TaskDailyTrendRow[]>(
      `WITH RECURSIVE days(day) AS (
         SELECT $1
         UNION ALL
         SELECT date(day, '+1 day')
         FROM days
         WHERE day < $2
       ),
       planned_tasks AS (
         SELECT planned_date AS day, COUNT(*) AS task_count
         FROM tasks
         WHERE planned_date BETWEEN $1 AND $2
           AND ($3 IS NULL OR project_id = $3)
         GROUP BY planned_date
       ),
       completed_tasks AS (
         SELECT date(completed_at, 'localtime') AS day, COUNT(*) AS task_count
         FROM tasks
         WHERE status = 'completed'
           AND completed_at IS NOT NULL
           AND date(completed_at, 'localtime') BETWEEN $1 AND $2
           AND ($3 IS NULL OR project_id = $3)
         GROUP BY date(completed_at, 'localtime')
       ),
       postponed_tasks AS (
         SELECT r.to_date AS day, COUNT(*) AS task_count
         FROM task_rollovers r
         JOIN tasks t ON t.id = r.task_id
         WHERE r.to_date BETWEEN $1 AND $2
           AND ($3 IS NULL OR t.project_id = $3)
         GROUP BY r.to_date
       )
       SELECT
         days.day AS date,
         COALESCE(planned_tasks.task_count, 0) AS planned_task_count,
         COALESCE(completed_tasks.task_count, 0) AS completed_task_count,
         COALESCE(postponed_tasks.task_count, 0) AS postponed_task_count
       FROM days
       LEFT JOIN planned_tasks ON planned_tasks.day = days.day
       LEFT JOIN completed_tasks ON completed_tasks.day = days.day
       LEFT JOIN postponed_tasks ON postponed_tasks.day = days.day
       ORDER BY days.day ASC`,
      [startDate, date, projectId],
    );

    return rows.map((row) => ({
      date: row.date,
      plannedTaskCount: row.planned_task_count,
      completedTaskCount: row.completed_task_count,
      postponedTaskCount: row.postponed_task_count,
    }));
  }

  override async create(draft: NormalizedTaskDraft): Promise<Task> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.database.execute(
      `INSERT INTO tasks (
         id, title, description, project_id, priority, status, planned_date,
         sort_order, estimated_minutes, actual_minutes, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, 'pending', $6,
         (
           SELECT COALESCE(MAX(sort_order), 0) + 100
           FROM tasks
           WHERE planned_date = $6 AND status = 'pending'
         ),
         $7, $8, $9, $9
       )`,
      [
        id,
        draft.title,
        draft.description,
        draft.projectId,
        draft.priority,
        draft.plannedDate,
        draft.estimatedMinutes,
        draft.actualMinutes,
        now,
      ],
    );

    return this.getById(id);
  }

  override async update(id: string, draft: NormalizedTaskDraft): Promise<void> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE tasks
       SET title = $1,
           description = $2,
           project_id = $3,
           priority = $4,
           sort_order = CASE
             WHEN planned_date <> $5 THEN (
               SELECT COALESCE(MAX(target.sort_order), 0) + 100
               FROM tasks target
               WHERE target.planned_date = $5 AND target.status = 'pending'
             )
             ELSE sort_order
           END,
           planned_date = $5,
           estimated_minutes = $6,
           actual_minutes = $7,
           updated_at = $8
       WHERE id = $9`,
      [
        draft.title,
        draft.description,
        draft.projectId,
        draft.priority,
        draft.plannedDate,
        draft.estimatedMinutes,
        draft.actualMinutes,
        now,
        id,
      ],
    );
  }

  override async complete(id: string, completedAt: string): Promise<void> {
    await this.database.execute(
      `UPDATE tasks
       SET status = 'completed', started_at = NULL, completed_at = $1, updated_at = $1
       WHERE id = $2 AND status = 'pending'`,
      [completedAt, id],
    );
  }

  override async reopen(id: string, updatedAt: string): Promise<void> {
    await this.database.execute(
      `UPDATE tasks
       SET status = 'pending', completed_at = NULL, updated_at = $1
       WHERE id = $2 AND status = 'completed'`,
      [updatedAt, id],
    );
  }

  override async updateTimeTracking(
    id: string,
    actualMinutes: number | null,
    startedAt: string | null,
    updatedAt: string,
  ): Promise<void> {
    await this.database.execute(
      `UPDATE tasks
       SET actual_minutes = $1,
           started_at = $2,
           updated_at = $3
       WHERE id = $4 AND status = 'pending'`,
      [actualMinutes, startedAt, updatedAt, id],
    );
  }

  override async delete(id: string): Promise<void> {
    await this.database.execute("DELETE FROM tasks WHERE id = $1", [id]);
  }

  override async restore(task: Task): Promise<void> {
    await this.database.execute(
      `INSERT INTO tasks (
         id, title, description, project_id, priority, status, planned_date,
         sort_order, estimated_minutes, actual_minutes, started_at, completed_at,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        task.id, task.title, task.description, task.projectId, task.priority,
        task.status, task.plannedDate, task.sortOrder, task.estimatedMinutes,
        task.actualMinutes, task.startedAt, task.completedAt, task.createdAt,
        task.updatedAt,
      ],
    );
  }

  override async reorder(ids: readonly string[], updatedAt: string): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const orderingRows = ids.map((id, index) => {
      const idParameter = values.push(id);
      const orderParameter = values.push((index + 1) * 100);
      return `($${idParameter}, $${orderParameter})`;
    });
    const updatedAtParameter = values.push(updatedAt);

    await this.database.execute(
      `WITH ordering(id, sort_order) AS (
         VALUES ${orderingRows.join(", ")}
       )
       UPDATE tasks
       SET sort_order = (
             SELECT ordering.sort_order FROM ordering WHERE ordering.id = tasks.id
           ),
           updated_at = $${updatedAtParameter}
       WHERE status = 'pending' AND id IN (SELECT id FROM ordering)`,
      values,
    );
  }

  override async moveToDate(id: string, date: LocalDate, updatedAt: string): Promise<void> {
    await this.database.execute(
      `UPDATE tasks
       SET planned_date = $1,
           sort_order = (
             SELECT COALESCE(MAX(target.sort_order), 0) + 100
             FROM tasks target
             WHERE target.planned_date = $1 AND target.status = 'pending'
           ),
           updated_at = $2
       WHERE id = $3 AND status = 'pending'`,
      [date, updatedAt, id],
    );
  }

  override async rollover(today: LocalDate, createdAt: string): Promise<number> {
    const result = await this.database.execute(
      `WITH candidates AS MATERIALIZED (
         SELECT
           id AS task_id,
           planned_date AS from_date,
           ROW_NUMBER() OVER (ORDER BY planned_date, sort_order, created_at) AS row_number,
           COUNT(*) OVER () AS total
         FROM tasks
         WHERE status = 'pending' AND planned_date < $1
       ),
       base AS MATERIALIZED (
         SELECT COALESCE(MIN(sort_order), 0) AS minimum_order
         FROM tasks
         WHERE status = 'pending' AND planned_date = $1
       )
       INSERT INTO task_rollovers (
         id, task_id, from_date, to_date, target_order, created_at
       )
       SELECT
         lower(hex(randomblob(16))),
         task_id,
         from_date,
         $1,
         minimum_order - ((total - row_number + 1) * 100),
         $2
       FROM candidates
       CROSS JOIN base`,
      [today, createdAt],
    );

    return result.rowsAffected;
  }

  private async getById(id: string): Promise<Task> {
    const rows = await this.database.select<TaskRow[]>(
      `SELECT ${TASK_COLUMNS}
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) {
      throw new Error("No se encontró la tarea guardada");
    }

    return mapTask(row);
  }
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    projectName: row.project_name,
    projectColor: row.project_color,
    priority: row.priority,
    status: row.status,
    plannedDate: row.planned_date,
    sortOrder: row.sort_order,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isInherited: row.is_inherited === 1,
  };
}

function mapTaskStatistics(row: TaskStatisticsRow): TaskStatistics {
  return {
    completedTaskCount: row.daily_completed_count,
    actualMinutes: row.daily_actual_count > 0 ? row.daily_actual_minutes : null,
    completedWithoutActualMinutes: row.daily_missing_actual_count,
    comparableTaskCount: row.daily_comparable_count,
    comparableEstimatedMinutes: row.daily_comparable_count > 0 ? row.daily_comparable_estimated_minutes : null,
    comparableActualMinutes: row.daily_comparable_count > 0 ? row.daily_comparable_actual_minutes : null,
    inheritedTaskCount: row.inherited_task_count,
    trend7Days: {
      completedTaskCount: row.trend_7_completed_count,
      actualMinutes: row.trend_7_actual_count > 0 ? row.trend_7_actual_minutes : null,
      completedWithoutActualMinutes: row.trend_7_missing_actual_count,
    },
    trend30Days: {
      completedTaskCount: row.trend_30_completed_count,
      actualMinutes: row.trend_30_actual_count > 0 ? row.trend_30_actual_minutes : null,
      completedWithoutActualMinutes: row.trend_30_missing_actual_count,
    },
  };
}
