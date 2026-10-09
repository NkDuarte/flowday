PRAGMA foreign_keys = ON;

CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    color TEXT NOT NULL CHECK (length(color) = 7 AND substr(color, 1, 1) = '#'),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX projects_active_name_unique
    ON projects (name COLLATE NOCASE)
    WHERE is_archived = 0;

CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    description TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    planned_date TEXT NOT NULL CHECK (length(planned_date) = 10),
    sort_order INTEGER NOT NULL,
    estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
    actual_minutes INTEGER CHECK (actual_minutes IS NULL OR actual_minutes >= 0),
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (
        (status = 'pending' AND completed_at IS NULL)
        OR (status = 'completed' AND completed_at IS NOT NULL)
    )
);

CREATE INDEX tasks_day_status_order_idx
    ON tasks (planned_date, status, sort_order);

CREATE INDEX tasks_project_idx
    ON tasks (project_id);

CREATE INDEX tasks_completed_at_idx
    ON tasks (completed_at)
    WHERE completed_at IS NOT NULL;

CREATE TABLE task_rollovers (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_date TEXT NOT NULL CHECK (length(from_date) = 10),
    to_date TEXT NOT NULL CHECK (length(to_date) = 10),
    target_order INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    CHECK (from_date < to_date),
    UNIQUE (task_id, to_date)
);

CREATE INDEX task_rollovers_to_date_idx
    ON task_rollovers (to_date);

CREATE TRIGGER validate_task_rollover
BEFORE INSERT ON task_rollovers
WHEN NOT EXISTS (
    SELECT 1
    FROM tasks
    WHERE id = NEW.task_id
      AND status = 'pending'
      AND planned_date = NEW.from_date
)
BEGIN
    SELECT RAISE(ABORT, 'rollover requires a pending task on its source date');
END;

CREATE TRIGGER apply_task_rollover
AFTER INSERT ON task_rollovers
BEGIN
    UPDATE tasks
    SET planned_date = NEW.to_date,
        sort_order = NEW.target_order,
        updated_at = NEW.created_at
    WHERE id = NEW.task_id
      AND status = 'pending'
      AND planned_date = NEW.from_date;
END;

CREATE TABLE evidence (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    relative_path TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
    created_at TEXT NOT NULL
);

CREATE INDEX evidence_task_idx
    ON evidence (task_id, created_at);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
