import { defaultAppearanceSettings } from "../../domain/appearance-settings-storage";
import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteAppearanceSettingsStorage } from "./sqlite-appearance-settings.storage";

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

describe("SqliteAppearanceSettingsStorage", () => {
  let database: FakeDatabase;
  let storage: SqliteAppearanceSettingsStorage;

  beforeEach(() => {
    database = new FakeDatabase();
    storage = new SqliteAppearanceSettingsStorage(database);
  });

  it("loads a complete saved appearance configuration", async () => {
    database.selectResult = [{ value_json: JSON.stringify(defaultAppearanceSettings) }];

    await expectAsync(storage.load()).toBeResolvedTo(defaultAppearanceSettings);
    expect(database.selections[0]?.values).toEqual(["appearance_settings"]);
  });

  it("ignores incomplete or malformed saved settings", async () => {
    database.selectResult = [{ value_json: '{"mode":"dark","dark":{}}' }];

    await expectAsync(storage.load()).toBeResolvedTo(null);
  });

  it("upserts appearance settings", async () => {
    await storage.save(defaultAppearanceSettings);

    expect(database.executions[0]?.query).toContain("ON CONFLICT(key) DO UPDATE");
    expect(database.executions[0]?.values[0]).toBe("appearance_settings");
    expect(database.executions[0]?.values[1]).toBe(JSON.stringify(defaultAppearanceSettings));
  });
});
