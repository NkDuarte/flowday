import { DatabaseExecution, DatabaseGateway } from "./database.gateway";
import { SqliteNoteRepository } from "./sqlite-note.repository";

class FakeDatabase extends DatabaseGateway {
  selectResult: unknown = [];
  readonly selections: Array<{ query: string; values: readonly unknown[] }> = [];
  readonly executions: Array<{ query: string; values: readonly unknown[] }> = [];

  override async select<T>(query: string, bindValues: readonly unknown[] = []): Promise<T> {
    this.selections.push({ query, values: bindValues });
    return this.selectResult as T;
  }

  override async execute(query: string, bindValues: readonly unknown[] = []): Promise<DatabaseExecution> {
    this.executions.push({ query, values: bindValues });
    return { rowsAffected: 1 };
  }
}

describe("SqliteNoteRepository", () => {
  let database: FakeDatabase;
  let repository: SqliteNoteRepository;

  beforeEach(() => {
    database = new FakeDatabase();
    repository = new SqliteNoteRepository(database);
  });

  it("lists notes ordered by their latest update", async () => {
    database.selectResult = [{
      id: "note-1",
      title: "Reunión",
      content_html: "<strong>Decisiones</strong>",
      created_at: "2026-08-18T10:00:00.000Z",
      updated_at: "2026-08-18T10:05:00.000Z",
    }];

    await expectAsync(repository.list()).toBeResolvedTo([jasmine.objectContaining({
      id: "note-1",
      title: "Reunión",
      contentHtml: "<strong>Decisiones</strong>",
    })]);
    expect(database.selections[0]?.query).toContain("ORDER BY updated_at DESC");
  });

  it("persists rich HTML while normalizing an empty title", async () => {
    const note = await repository.create({ title: "  ", contentHtml: "<ul><li>Idea</li></ul>" });

    expect(database.executions[0]?.query).toContain("INSERT INTO notes");
    expect(database.executions[0]?.values.slice(1, 3)).toEqual(["Nota sin título", "<ul><li>Idea</li></ul>"]);
    expect(note.contentHtml).toBe("<ul><li>Idea</li></ul>");
  });

  it("updates and deletes a note", async () => {
    database.selectResult = [{
      id: "note-1",
      title: "Nueva",
      content_html: "<p>Contenido</p>",
      created_at: "2026-08-18T10:00:00.000Z",
      updated_at: "2026-08-18T10:05:00.000Z",
    }];

    await repository.update("note-1", { title: "Nueva", contentHtml: "<p>Contenido</p>" });
    await repository.delete("note-1");

    expect(database.executions[0]?.query).toContain("UPDATE notes");
    expect(database.executions[1]?.values).toEqual(["note-1"]);
  });
});
