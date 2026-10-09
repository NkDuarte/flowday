import { Note, NoteDraft } from "./note";

export abstract class NoteRepository {
  abstract list(): Promise<readonly Note[]>;
  abstract create(draft: NoteDraft): Promise<Note>;
  abstract update(id: string, draft: NoteDraft): Promise<Note>;
  abstract delete(id: string): Promise<void>;
}
