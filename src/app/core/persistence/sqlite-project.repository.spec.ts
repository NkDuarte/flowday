import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteProjectRepository } from "./sqlite-project.repository";

class FakeDatabase extends DatabaseGateway {
  readonly executions: Array<{ query: string; values: readonly unknown[] }> = [];
  selectResult: unknown[] = [];

  override async select<T>(): Promise<T> {
    return this.selectResult as T;
  }

  override async execute(query: string, values: readonly unknown[] = []): Promise<DatabaseExecution> {
    this.executions.push({ query, values });
    return { rowsAffected: 1 };
  }
}

describe("SqliteProjectRepository", () => {
  it("lists active projects alphabetically", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);
    database.selectResult = [
      {
        id: "project-1",
        name: "Flowday",
        color: "#237A58",
        icon_name: "folder-kanban",
        logo_relative_path: null,
        is_archived: 0,
        created_at: "2026-08-17T13:00:00.000Z",
        updated_at: "2026-08-17T13:00:00.000Z",
      },
    ];

    const [project] = await repository.listActive();

    expect(project).toEqual(
      jasmine.objectContaining({
        name: "Flowday",
        color: "#237A58",
        iconName: "folder-kanban",
        logoRelativePath: null,
        isArchived: false,
      }),
    );
  });

  it("persists the selected project identity", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);
    database.selectResult = [
      {
        id: "project-1",
        name: "Flowday",
        color: "#237A58",
        icon_name: null,
        logo_relative_path: "project-logos/flowday.png",
        is_archived: 0,
        created_at: "2026-08-17T13:00:00.000Z",
        updated_at: "2026-08-17T13:00:00.000Z",
      },
    ];

    await repository.create({
      name: "Flowday",
      color: "#237A58",
      logoRelativePath: "project-logos/flowday.png",
    });

    expect(database.executions[0].values.slice(1, 5)).toEqual([
      "Flowday",
      "#237A58",
      null,
      "project-logos/flowday.png",
    ]);
  });

  it("updates a project while preserving its identity", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);
    database.selectResult = [
      {
        id: "project-1",
        name: "Cliente Aurora",
        color: "#3C7F9A",
        icon_name: "folder-kanban",
        logo_relative_path: null,
        is_archived: 0,
        created_at: "2026-08-17T13:00:00.000Z",
        updated_at: "2026-08-17T14:00:00.000Z",
      },
    ];

    await repository.update("project-1", {
      name: "Cliente Aurora",
      color: "#3C7F9A",
      iconName: "folder-kanban",
    });

    expect(database.executions[0].values.slice(0, 4)).toEqual([
      "Cliente Aurora",
      "#3C7F9A",
      "folder-kanban",
      null,
    ]);
  });

  it("archives a project without deleting it", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);

    await repository.archive("project-1");

    expect(database.executions[0].query).toContain("SET is_archived = 1");
    expect(database.executions[0].values[1]).toBe("project-1");
  });

  it("marks a project as deleted so it can be restored", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);

    await repository.delete("project-1");

    expect(database.executions[0].query).toContain("SET is_deleted = 1");
    expect(database.executions[0].values[1]).toBe("project-1");
  });

  it("lists archived projects separately", async () => {
    const database = new FakeDatabase();
    const repository = new SqliteProjectRepository(database);
    database.selectResult = [];

    await repository.listArchived();

    expect(database.executions).toHaveSize(0);
  });
});