import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  LucideCalendarDays,
  LucideBriefcaseBusiness,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircle,
  LucideClock3,
  LucideCode2,
  LucideFolderKanban,
  LucideGripVertical,
  LucidePalette,
  LucidePencil,
  LucidePlus,
  LucideRocket,
  LucideRotateCcw,
  LucideSettings,
  LucideTrash2,
} from "@lucide/angular";
import { provideLucideIcons } from "@lucide/angular";
import { Clock, SystemClock } from "./domain/clock";
import { EvidenceRepository } from "./domain/evidence-repository";
import { ProjectRepository } from "./domain/project-repository";
import { TaskRepository } from "./domain/task-repository";
import { DatabaseGateway } from "./core/persistence/database.gateway";
import { EvidenceStorage } from "./core/evidence-storage";
import { ProjectIdentityStorage } from "./core/project-identity-storage";
import { SqliteEvidenceRepository } from "./core/persistence/sqlite-evidence.repository";
import { SqliteProjectRepository } from "./core/persistence/sqlite-project.repository";
import { SqliteTaskRepository } from "./core/persistence/sqlite-task.repository";
import { TauriDatabaseGateway } from "./core/persistence/tauri-database.gateway";
import { TauriEvidenceStorage } from "./core/tauri-evidence.storage";
import { TauriProjectIdentityStorage } from "./core/tauri-project-identity.storage";
import { SqliteWindowGeometryStorage } from "./core/persistence/sqlite-window-geometry.storage";
import { WindowGeometryStorage } from "./domain/window-geometry-storage";
import { NoteRepository } from "./domain/note-repository";
import { SqliteNoteRepository } from "./core/persistence/sqlite-note.repository";
import { AppearanceSettingsStorage } from "./domain/appearance-settings-storage";
import { SqliteAppearanceSettingsStorage } from "./core/persistence/sqlite-appearance-settings.storage";
import { NotificationSettingsStorage } from "./domain/notification-settings-storage";
import { SqliteNotificationSettingsStorage } from "./core/persistence/sqlite-notification-settings.storage";

import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideLucideIcons(
      LucideCalendarDays,
      LucideBriefcaseBusiness,
      LucideCheck,
      LucideChevronLeft,
      LucideChevronRight,
      LucideCircle,
      LucideClock3,
      LucideCode2,
      LucideFolderKanban,
      LucideGripVertical,
      LucidePalette,
      LucidePencil,
      LucidePlus,
      LucideRocket,
      LucideRotateCcw,
      LucideSettings,
      LucideTrash2,
    ),
    { provide: Clock, useClass: SystemClock },
    { provide: DatabaseGateway, useClass: TauriDatabaseGateway },
    { provide: EvidenceStorage, useClass: TauriEvidenceStorage },
    { provide: ProjectIdentityStorage, useClass: TauriProjectIdentityStorage },
    { provide: EvidenceRepository, useClass: SqliteEvidenceRepository },
    { provide: ProjectRepository, useClass: SqliteProjectRepository },
    { provide: TaskRepository, useClass: SqliteTaskRepository },
    { provide: WindowGeometryStorage, useClass: SqliteWindowGeometryStorage },
    { provide: AppearanceSettingsStorage, useClass: SqliteAppearanceSettingsStorage },
    { provide: NotificationSettingsStorage, useClass: SqliteNotificationSettingsStorage },
    { provide: NoteRepository, useClass: SqliteNoteRepository },
  ],
};
