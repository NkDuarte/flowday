import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteEvidenceRepository } from "./sqlite-evidence.repository";

class FakeDatabase extends DatabaseGateway {
  readonly executions: Array<{ query: string; values: readonly unknown[] }> = [];
  selectResult: unknown = [];

  override async select<T>(): Promise<T> {
    return this.selectResult as T;
  }

  override async execute(
    query: string,
    bindValues: readonly unknown[] = [],
  ): Promise<DatabaseExecution> {
    this.executions.push({ query, values: bindValues });
    return { rowsAffected: 1 };
  }
}

describe("SqliteEvidenceRepository", () => {
  let database: FakeDatabase;
  let repository: SqliteEvidenceRepository;

  beforeEach(() => {
    database = new FakeDatabase();
    repository = new SqliteEvidenceRepository(database);
  });

  it("persists selected image metadata", async () => {
    const evidence = await repository.create({
      taskId: "task-1",
      relativePath: "evidence/task-1/photo.png",
      originalName: "photo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
    });

    expect(database.executions[0].query).toContain("INSERT INTO evidence");
    expect(database.executions[0].values).toEqual([
      evidence.id,
      "task-1",
      "evidence/task-1/photo.png",
      "photo.png",
      "image/png",
      1024,
      evidence.createdAt,
    ]);
  });

  it("restores evidence with its original identifier", async () => {
    await repository.restore({
      id: "evidence-1",
      taskId: "task-1",
      relativePath: "evidence/task-1/photo.png",
      originalName: "photo.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      createdAt: "2026-08-17T13:00:00.000Z",
    });

    expect(database.executions[0].values[0]).toBe("evidence-1");
  });

  it("maps saved evidence for a task", async () => {
    database.selectResult = [{
      id: "evidence-1",
      task_id: "task-1",
      relative_path: "evidence/task-1/photo.png",
      original_name: "photo.png",
      mime_type: "image/png",
      size_bytes: 1024,
      created_at: "2026-08-17T13:00:00.000Z",
    }];

    const [evidence] = await repository.listForTask("task-1");

    expect(evidence).toEqual(jasmine.objectContaining({
      taskId: "task-1",
      originalName: "photo.png",
      mimeType: "image/png",
    }));
  });
});