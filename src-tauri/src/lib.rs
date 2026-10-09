use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:flowday.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "project_identity",
            sql: include_str!("../migrations/0002_project_identity.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "project_recovery",
            sql: include_str!("../migrations/0003_project_recovery.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "notes",
            sql: include_str!("../migrations/0004_notes.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use rusqlite::{params, Connection};

    fn migrated_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        connection
            .execute_batch(include_str!("../migrations/0001_initial.sql"))
            .expect("apply initial migration");
        connection
            .execute_batch(include_str!("../migrations/0002_project_identity.sql"))
            .expect("apply project identity migration");
        connection
            .execute_batch(include_str!("../migrations/0003_project_recovery.sql"))
            .expect("apply project recovery migration");
        connection
            .execute_batch(include_str!("../migrations/0004_notes.sql"))
            .expect("apply notes migration");
        connection
    }

    fn insert_task(connection: &Connection, id: &str, status: &str, completed_at: Option<&str>) {
        connection
            .execute(
                "INSERT INTO tasks (
                    id, title, priority, status, planned_date, sort_order,
                    completed_at, created_at, updated_at
                 ) VALUES (?1, 'Task', 'medium', ?2, '2026-08-16', 100, ?3, ?4, ?4)",
                params![id, status, completed_at, "2026-08-16T12:00:00.000Z"],
            )
            .expect("insert task");
    }

    #[test]
    fn creates_the_expected_schema() {
        let connection = migrated_connection();
        let mut statement = connection
            .prepare(
                "SELECT name FROM sqlite_master
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                 ORDER BY name",
            )
            .expect("prepare schema query");
        let tables = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query tables")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect tables");

        assert_eq!(
            tables,
            [
                "app_settings",
                "evidence",
                "notes",
                "projects",
                "task_rollovers",
                "tasks"
            ]
        );
    }

    #[test]
    fn adds_project_identity_columns() {
        let connection = migrated_connection();
        connection
            .execute(
                "INSERT INTO projects (id, name, color, icon_name, logo_relative_path, created_at, updated_at)
                 VALUES ('project-1', 'Aurora', '#237A58', 'briefcase-business', NULL, ?1, ?1)",
                ["2026-08-16T12:00:00.000Z"],
            )
            .expect("insert project identity");

        let identity: (Option<String>, Option<String>) = connection
            .query_row(
                "SELECT icon_name, logo_relative_path FROM projects WHERE id = 'project-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read project identity");

        assert_eq!(identity, (Some("briefcase-business".to_owned()), None));
    }

    #[test]
    fn applies_a_rollover_once_and_updates_the_task() {
        let connection = migrated_connection();
        insert_task(&connection, "task-1", "pending", None);

        connection
            .execute(
                "INSERT INTO task_rollovers (
                    id, task_id, from_date, to_date, target_order, created_at
                 ) VALUES ('rollover-1', 'task-1', '2026-08-16', '2026-08-17', -100, ?1)",
                ["2026-08-17T08:00:00.000Z"],
            )
            .expect("insert rollover");

        let task: (String, i64) = connection
            .query_row(
                "SELECT planned_date, sort_order FROM tasks WHERE id = 'task-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query rolled over task");
        assert_eq!(task, ("2026-08-17".to_owned(), -100));

        let duplicate = connection.execute(
            "INSERT INTO task_rollovers (
                id, task_id, from_date, to_date, target_order, created_at
             ) VALUES ('rollover-2', 'task-1', '2026-08-16', '2026-08-17', -99, ?1)",
            ["2026-08-17T08:01:00.000Z"],
        );
        assert!(duplicate.is_err());
    }

    #[test]
    fn rejects_rollover_for_a_completed_task() {
        let connection = migrated_connection();
        insert_task(
            &connection,
            "task-1",
            "completed",
            Some("2026-08-16T13:00:00.000Z"),
        );

        let result = connection.execute(
            "INSERT INTO task_rollovers (
                id, task_id, from_date, to_date, target_order, created_at
             ) VALUES ('rollover-1', 'task-1', '2026-08-16', '2026-08-17', -100, ?1)",
            ["2026-08-17T08:00:00.000Z"],
        );

        assert!(result.is_err());
    }

    #[test]
    fn cascades_evidence_when_a_task_is_deleted() {
        let connection = migrated_connection();
        insert_task(&connection, "task-1", "pending", None);
        connection
            .execute(
                "INSERT INTO evidence (
                    id, task_id, relative_path, original_name, mime_type, size_bytes, created_at
                 ) VALUES (
                    'evidence-1', 'task-1', 'evidence/task-1/image.png', 'image.png',
                    'image/png', 1024, '2026-08-16T12:00:00.000Z'
                 )",
                [],
            )
            .expect("insert evidence");

        connection
            .execute("DELETE FROM tasks WHERE id = 'task-1'", [])
            .expect("delete task");
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM evidence", [], |row| row.get(0))
            .expect("count evidence");

        assert_eq!(count, 0);
    }
}
