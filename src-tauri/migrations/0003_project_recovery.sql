ALTER TABLE projects ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1));

CREATE INDEX projects_archived_idx
    ON projects (is_archived, is_deleted, name COLLATE NOCASE);
