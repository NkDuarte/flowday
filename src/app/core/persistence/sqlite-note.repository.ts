import { Injectable } from "@angular/core";
import { Note, NoteDraft } from "../../domain/note";
import { NoteRepository } from "../../domain/note-repository";
import { DatabaseGateway } from "./database.gateway";

interface NoteRow {
  readonly id: string;
  readonly title: string;
  readonly content_html: string;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class SqliteNoteRepository extends NoteRepository {
  constructor(private readonly database: DatabaseGateway) {
    super();
  }

  override async list(): Promise<readonly Note[]> {
    const rows = await this.database.select<NoteRow[]>(
      `SELECT id, title, content_html, created_at, updated_at
       FROM notes
       ORDER BY updated_at DESC`,
    );
    return rows.map(mapNote);
  }

  override async create(draft: NoteDraft): Promise<Note> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.database.execute(
      `INSERT INTO notes (id, title, content_html, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)`,
      [id, draft.title.trim() || "Nota sin título", draft.contentHtml, now],
    );
    return { id, title: draft.title.trim() || "Nota sin título", contentHtml: draft.contentHtml, createdAt: now, updatedAt: now };
  }

  override async update(id: string, draft: NoteDraft): Promise<Note> {
    const now = new Date().toISOString();
    await this.database.execute(
      `UPDATE notes
       SET title = $1, content_html = $2, updated_at = $3
       WHERE id = $4`,
      [draft.title.trim() || "Nota sin título", draft.contentHtml, now, id],
    );
    const note = (await this.list()).find((item) => item.id === id);
    if (!note) {
      throw new Error("La nota ya no existe");
    }
    return note;
  }

  override async delete(id: string): Promise<void> {
    await this.database.execute("DELETE FROM notes WHERE id = $1", [id]);
  }
}

function mapNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    contentHtml: row.content_html,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
