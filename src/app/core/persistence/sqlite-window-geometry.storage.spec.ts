import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteWindowGeometryStorage } from "./sqlite-window-geometry.storage";

class FakeDatabase extends DatabaseGateway {
  selectResult: unknown = [];
  readonly selections: Array<{ query: string; values: readonly unknown[] }> = [];
  readonly executions: Array<{ query: string; values: readonly unknown[] }> = [];

  override async select<T>(query: string, bindValues: readonly unknown[] = []): Promise<T> {
    this.selections.push({ query, values: bindValues });
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

describe("SqliteWindowGeometryStorage", () => {
  let database: FakeDatabase;
  let storage: SqliteWindowGeometryStorage;

  beforeEach(() => {
    database = new FakeDatabase();
    storage = new SqliteWindowGeometryStorage(database);
  });

  it("loads only a valid saved geometry for the requested mode", async () => {
    database.selectResult = [{ value_json: '{"width":1040,"height":760,"x":100,"y":80}' }];

    await expectAsync(storage.load("full")).toBeResolvedTo({ width: 1040, height: 760, x: 100, y: 80 });
    expect(database.selections[0]?.values).toEqual(["window_geometry_full"]);
  });

  it("ignores malformed persisted geometry", async () => {
    database.selectResult = [{ value_json: '{"width":0,"height":760,"x":100,"y":80}' }];

    await expectAsync(storage.load("compact")).toBeResolvedTo(null);
  });

  it("upserts geometry independently for each window mode", async () => {
    await storage.save("compact", { width: 330, height: 288, x: 100, y: 80 });

    expect(database.executions[0]?.query).toContain("ON CONFLICT(key) DO UPDATE");
    expect(database.executions[0]?.values.slice(0, 2)).toEqual([
      "window_geometry_compact",
      '{"width":330,"height":288,"x":100,"y":80}',
    ]);
  });
});