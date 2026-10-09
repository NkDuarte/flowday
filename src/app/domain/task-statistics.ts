export interface TaskTrend {
  readonly completedTaskCount: number;
  readonly actualMinutes: number | null;
  readonly completedWithoutActualMinutes: number;
}

export interface TaskDailyTrend {
  readonly date: string;
  readonly plannedTaskCount: number;
  readonly completedTaskCount: number;
  readonly postponedTaskCount: number;
}

export interface TaskStatistics {
  readonly completedTaskCount: number;
  readonly actualMinutes: number | null;
  readonly completedWithoutActualMinutes: number;
  readonly comparableTaskCount: number;
  readonly comparableEstimatedMinutes: number | null;
  readonly comparableActualMinutes: number | null;
  readonly inheritedTaskCount: number;
  readonly trend7Days: TaskTrend;
  readonly trend30Days: TaskTrend;
}

export const EMPTY_TASK_STATISTICS: TaskStatistics = {
  completedTaskCount: 0,
  actualMinutes: null,
  completedWithoutActualMinutes: 0,
  comparableTaskCount: 0,
  comparableEstimatedMinutes: null,
  comparableActualMinutes: null,
  inheritedTaskCount: 0,
  trend7Days: {
    completedTaskCount: 0,
    actualMinutes: null,
    completedWithoutActualMinutes: 0,
  },
  trend30Days: {
    completedTaskCount: 0,
    actualMinutes: null,
    completedWithoutActualMinutes: 0,
  },
};