import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from "@angular/cdk/drag-drop";
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, ViewChild, inject, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { LogicalSize, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { availableMonitors, currentMonitor, getCurrentWindow, type Monitor } from "@tauri-apps/api/window";
import {
  LucideBriefcaseBusiness,
  LucideCalendarDays,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideCircle,
  LucideClock3,
  LucideCode2,
  LucideEllipsisVertical,
  LucideArchive,
  LucideArchiveRestore,
  LucideArrowDown,
  LucideArrowUp,
  LucideFolderKanban,
  LucideGripVertical,
  LucideMaximize2,
  LucideMinimize2,
  LucideMinus,
  LucidePalette,
  LucidePaperclip,
  LucidePencil,
  LucidePin,
  LucidePlay,
  LucidePlus,
  LucideRocket,
  LucideSearch,
  LucideSettings,
  LucideSquare,
  LucideTrash2,
  LucideX,
} from "@lucide/angular";
import { ProjectIdentityStorage, SelectedProjectLogo } from "../../core/project-identity-storage";
import { EvidenceStorage } from "../../core/evidence-storage";
import { EvidenceRepository } from "../../domain/evidence-repository";
import { Evidence } from "../../domain/evidence";
import { LocalDate } from "../../domain/local-date";
import { normalizeProjectDraft, Project } from "../../domain/project";
import { ProjectRepository } from "../../domain/project-repository";
import { TaskRepository } from "../../domain/task-repository";
import { TaskDailyTrend, TaskStatistics, TaskTrend } from "../../domain/task-statistics";
import { WindowGeometry, WindowGeometryStorage, WindowMode } from "../../domain/window-geometry-storage";
import { Task, TaskPriority, TaskStatus } from "../../domain/task";
import { Note } from "../../domain/note";
import { NoteRepository } from "../../domain/note-repository";
import {
  AppearanceMode,
  AppearancePalette,
  AppearanceSettings,
  AppearanceSettingsStorage,
  defaultAppearanceSettings,
} from "../../domain/appearance-settings-storage";
import {
  defaultNotificationSettings,
  NotificationSettings,
  NotificationSettingsStorage,
} from "../../domain/notification-settings-storage";
import { DayStore } from "./day.store";

type NoticeTone = "success" | "error" | "warning";

interface Notice {
  readonly message: string;
  readonly tone: NoticeTone;
  readonly undo?: () => Promise<void>;
}

interface PendingPriorityDrop {
  readonly task: Task;
  readonly previousIndex: number;
  readonly currentIndex: number;
}

interface PendingTimedCompletion {
  readonly task: Task;
  readonly elapsedMinutes: number;
}

const defaultFullWindowWidth = 1040;
const defaultFullWindowHeight = 760;
const minimumFullWindowWidth = 800;
const minimumFullWindowHeight = 600;

@Component({
  selector: "app-day-page",
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ReactiveFormsModule,
    LucideBriefcaseBusiness,
    LucideCalendarDays,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCircle,
    LucideClock3,
    LucideCode2,
    LucideEllipsisVertical,
    LucideArchive,
    LucideArchiveRestore,
    LucideArrowDown,
    LucideArrowUp,
    LucideFolderKanban,
    LucideGripVertical,
    LucideMaximize2,
    LucideMinimize2,
    LucideMinus,
    LucidePalette,
    LucidePaperclip,
    LucidePencil,
    LucidePin,
    LucidePlay,
    LucidePlus,
    LucideRocket,
    LucideSearch,
    LucideSettings,
    LucideSquare,
    LucideTrash2,
    LucideX,
  ],
  providers: [DayStore],
  templateUrl: "./day.page.html",
  styleUrl: "./day.page.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayPage {
  readonly store = inject(DayStore);
  private readonly taskRepository = inject(TaskRepository);
  private readonly projectRepository = inject(ProjectRepository);
  private readonly projectIdentityStorage = inject(ProjectIdentityStorage);
  private readonly evidenceRepository = inject(EvidenceRepository);
  private readonly evidenceStorage = inject(EvidenceStorage);
  private readonly windowGeometryStorage = inject(WindowGeometryStorage);
  private readonly appearanceSettingsStorage = inject(AppearanceSettingsStorage);
  private readonly notificationSettingsStorage = inject(NotificationSettingsStorage);
  readonly quickTask = new FormControl("", { nonNullable: true, validators: [Validators.required] });
  readonly editingTask = signal<Task | null>(null);
  readonly taskEvidence = signal<readonly Evidence[]>([]);
  readonly evidenceUrls = signal<Readonly<Record<string, string>>>({});
  readonly editingProject = signal<Project | null>(null);
  readonly inlineTaskTitleId = signal<string | null>(null);
  readonly inlineProjectTitleId = signal<string | null>(null);
  readonly inlineTaskTitle = new FormControl("", { nonNullable: true });
  readonly inlineProjectTitle = new FormControl("", { nonNullable: true });
  readonly notice = signal<Notice | null>(null);
  readonly projects = signal<readonly Project[]>([]);
  readonly creatingProject = signal(false);
  readonly projectCreatorOpen = signal(false);
  readonly projectRailCollapsed = signal(false);
  readonly compactView = signal(false);
  readonly compactAlwaysOnTop = signal(true);
  readonly compactTaskLimit = signal(5);
  readonly completedOpen = signal(false);
  readonly statisticsExpanded = signal(false);
  readonly chartRange = signal<7 | 15 | 30>(7);
  readonly chartRanges = [7, 15, 30] as const;
  readonly completedTaskDetail = signal<Task | null>(null);
  readonly completedTaskEvidence = signal<readonly Evidence[]>([]);
  readonly completedTaskEvidenceUrls = signal<Readonly<Record<string, string>>>({});
  readonly appearanceSettingsOpen = signal(false);
  readonly settingsSection = signal<"appearance" | "notifications">("appearance");
  readonly appearanceSettings = signal<AppearanceSettings>(defaultAppearanceSettings);
  readonly notificationSettings = signal<NotificationSettings>(defaultNotificationSettings);
  readonly workspaceView = signal<"tasks" | "ideas">("tasks");
  readonly notesViewMode = signal<"grid" | "list">("grid");
  readonly noteImageWidths = [25, 50, 75, 100] as const;
  readonly notes = signal<readonly Note[]>([]);
  readonly noteEditorOpen = signal(false);
  readonly editingNote = signal<Note | null>(null);
  readonly noteIsDraft = signal(false);
  readonly noteTitle = signal("");
  readonly selectedNoteImage = signal<HTMLImageElement | null>(null);
  readonly noteSaving = signal(false);
  private readonly noteRepository = inject(NoteRepository);
  readonly activePriorityFilter = signal<TaskPriority | "all">("all");
  readonly globalSearchOpen = signal(false);
  readonly viewingSearchTask = signal<Task | null>(null);
  readonly globalSearchCandidates = signal<readonly Task[]>([]);
  readonly globalSearchResults = signal<readonly Task[]>([]);
  readonly globalSearchNoteResults = signal<readonly Note[]>([]);
  readonly globalSearchLoading = signal(false);
  readonly globalSearchError = signal<string | null>(null);
  readonly projectActionsOpenFor = signal<string | null>(null);
  readonly projectActionsPosition = signal<{ top: number; left: number } | null>(null);
  readonly archivedProjectsOpen = signal(false);
  readonly archivedProjects = signal<readonly Project[]>([]);
  readonly archiveConfirmationProject = signal<Project | null>(null);
  readonly deleteConfirmationProject = signal<Project | null>(null);
  readonly deleteConfirmationTask = signal<Task | null>(null);
  readonly priorityDropConfirmation = signal<PendingPriorityDrop | null>(null);
  readonly pendingTimedCompletion = signal<PendingTimedCompletion | null>(null);
  readonly deleteConfirmation = new FormControl("", { nonNullable: true });
  readonly projectIdentityMode = signal<"icon" | "logo">("icon");
  readonly selectedProjectLogo = signal<SelectedProjectLogo | null>(null);
  readonly selectedProjectLogoPreviewUrl = signal<string | null>(null);
  readonly projectEditorIdentityMode = signal<"icon" | "logo">("icon");
  readonly selectedEditedProjectLogo = signal<SelectedProjectLogo | null>(null);
  readonly selectedEditedProjectLogoPreviewUrl = signal<string | null>(null);
  private readonly trackingNow = signal(Date.now());
  readonly projectLogoUrls = signal<Readonly<Record<string, string>>>({});
  readonly projectColors = ["#237A58", "#C15D45", "#3C7F9A", "#B78B32"];
  readonly projectIcons = ["folder-kanban", "briefcase-business", "code-2", "palette", "rocket"] as const;
  readonly appearancePaletteModes = ["light", "dark"] as const;
  readonly appearanceColorFields: readonly { readonly key: keyof AppearancePalette; readonly label: string }[] = [
    { key: "canvas", label: "Fondo" },
    { key: "surface", label: "Superficie" },
    { key: "surfaceRaised", label: "Superficie elevada" },
    { key: "ink", label: "Texto" },
    { key: "muted", label: "Texto secundario" },
    { key: "line", label: "Líneas" },
    { key: "lineStrong", label: "Bordes" },
    { key: "accent", label: "Acento" },
    { key: "plannedLine", label: "Línea de tareas" },
    { key: "focus", label: "Foco" },
    { key: "actionSurface", label: "Acción" },
    { key: "actionInk", label: "Texto de acción" },
    { key: "actionInk", label: "Texto de acción" },
  ];
  readonly editor = new FormGroup({
    title: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl("", { nonNullable: true }),
    priority: new FormControl<TaskPriority>("medium", { nonNullable: true }),
    plannedDate: new FormControl<LocalDate>(this.store.selectedDate(), { nonNullable: true }),
    estimatedMinutes: new FormControl<number | null>(null),
    actualMinutes: new FormControl<number | null>(null),
    projectId: new FormControl<string | null>(null),
  });
  readonly globalSearch = new FormGroup({
    query: new FormControl("", { nonNullable: true }),
    status: new FormControl<TaskStatus | "all">("all", { nonNullable: true }),
    priority: new FormControl<TaskPriority | "all">("all", { nonNullable: true }),
    projectId: new FormControl("", { nonNullable: true }),
  });
  readonly newProject = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    color: new FormControl(this.projectColors[0], { nonNullable: true }),
    iconName: new FormControl<(typeof this.projectIcons)[number]>("folder-kanban", { nonNullable: true }),
  });
  readonly projectEditor = new FormGroup({
    name: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
    color: new FormControl(this.projectColors[0], { nonNullable: true }),
    iconName: new FormControl<(typeof this.projectIcons)[number]>("folder-kanban", { nonNullable: true }),
  });
  readonly locale = "es-CO";
  private readonly destroyRef = inject(DestroyRef);
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  private trackingTimer: ReturnType<typeof setInterval> | undefined;
  private expandedWindowGeometry: WindowGeometry | null = null;
  private globalSearchSequence = 0;
  private rolloverRefreshInFlight = false;
  private systemThemeMediaQuery: MediaQueryList | null = null;
  private noteSaveTimer: ReturnType<typeof setTimeout> | undefined;
  private noteSaveSequence = 0;
  @ViewChild("noteEditor") private noteEditor?: ElementRef<HTMLDivElement>;
  @ViewChild("noteImageInput") private noteImageInput?: ElementRef<HTMLInputElement>;
  @ViewChild("datePicker") private datePicker?: ElementRef<HTMLInputElement>;
  private readonly handleSystemThemeChange = (): void => {
    const settings = this.appearanceSettings();
    if (settings.mode === "system") this.applyAppearance(settings);
  };

  constructor() {
    void this.initialize();
    this.trackingTimer = setInterval(() => this.trackingNow.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => {
      if (this.noticeTimer) clearTimeout(this.noticeTimer);
      if (this.trackingTimer) clearInterval(this.trackingTimer);
      if (this.noteSaveTimer) clearTimeout(this.noteSaveTimer);
      this.systemThemeMediaQuery?.removeEventListener("change", this.handleSystemThemeChange);
    });
  }

  get dateLabel(): string {
    const [year, month, day] = this.store.selectedDate().split("-").map(Number);
    return new Intl.DateTimeFormat(this.locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(year, month - 1, day));
  }

  selectedProject(): Project | null {
    return this.projects().find((project) => project.id === this.store.selectedProjectId()) ?? null;
  }

  projectBackground(color: string): string { return `linear-gradient(135deg, ${color}38, ${color}12)`; }
  projectLogoUrl(project: Project): string | null { return project.logoRelativePath ? this.projectLogoUrls()[project.id] ?? null : null; }
  projectForId(id: string): Project | null { return this.projects().find((project) => project.id === id) ?? null; }
  compactTasks(): readonly Task[] { return this.visibleActiveTasks().slice(0, this.compactTaskLimit()); }
  visibleActiveTasks(): readonly Task[] {
    const priority = this.activePriorityFilter();
    return priority === "all" ? this.store.activeTasks() : this.store.activeTasks().filter((task) => task.priority === priority);
  }
  toggleActivePriorityFilter(priority: TaskPriority): void { this.activePriorityFilter.update((current) => current === priority ? "all" : priority); }
  updateAppearanceMode(mode: AppearanceMode): void { this.persistAppearance({ ...this.appearanceSettings(), mode }); }
  updateAppearanceColor(mode: "light" | "dark", key: keyof AppearancePalette, color: string): void {
    const normalizedColor = color.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalizedColor)) return;
    const settings = this.appearanceSettings();
    this.persistAppearance({ ...settings, [mode]: { ...settings[mode], [key]: normalizedColor } });
  }
  resetAppearance(): void { this.persistAppearance(defaultAppearanceSettings); }
  updateNotificationEnabled(schedule: "morning" | "evening", enabled: boolean): void {
    this.persistNotificationSettings({
      ...this.notificationSettings(),
      [schedule === "morning" ? "morningEnabled" : "eveningEnabled"]: enabled,
    });
  }
  updateNotificationTime(schedule: "morning" | "evening", event: Event): void {
    const time = (event.target as HTMLInputElement).value;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    this.persistNotificationSettings({
      ...this.notificationSettings(),
      [schedule === "morning" ? "morningTime" : "eveningTime"]: time,
    });
  }

  async openIdeasWorkspace(): Promise<void> { this.workspaceView.set("ideas"); await this.loadNotes(); }
  createNote(): void {
    const now = new Date().toISOString();
    this.workspaceView.set("ideas");
    this.openNoteEditor({ id: crypto.randomUUID(), title: "Nota sin título", contentHtml: "", createdAt: now, updatedAt: now }, true);
  }
  openNoteEditor(note: Note, isDraft = false): void { this.editingNote.set(note); this.noteIsDraft.set(isDraft); this.noteTitle.set(note.title); this.selectedNoteImage.set(null); this.noteEditorOpen.set(true); setTimeout(() => { if (this.noteEditor) { this.noteEditor.nativeElement.innerHTML = note.contentHtml; this.noteEditor.nativeElement.focus(); } }); }
  async closeNoteEditor(): Promise<void> { await this.saveNoteNow(); this.noteEditorOpen.set(false); this.editingNote.set(null); this.noteIsDraft.set(false); this.selectedNoteImage.set(null); }
  onNoteTitleInput(event: Event): void { this.noteTitle.set((event.target as HTMLInputElement).value); this.scheduleNoteSave(); }
  onNoteEditorInput(): void { this.selectedNoteImage.set(null); this.scheduleNoteSave(); }
  executeNoteCommand(command: string, value?: string): void { this.noteEditor?.nativeElement.focus(); document.execCommand(command, false, value); this.scheduleNoteSave(); }
  openNoteImagePicker(): void { this.noteImageInput?.nativeElement.click(); }
  async handleNoteImageInput(event: Event): Promise<void> { const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ""; if (file) await this.insertNoteImageFile(file); }
  async handleNotePaste(event: ClipboardEvent): Promise<void> { const item = Array.from(event.clipboardData?.items ?? []).find((candidate) => candidate.type.startsWith("image/")); if (item) { event.preventDefault(); const file = item.getAsFile(); if (file) await this.insertNoteImageFile(file); } }
  async handleNoteDrop(event: DragEvent): Promise<void> { event.preventDefault(); this.placeNoteCaret(event.clientX, event.clientY); const file = Array.from(event.dataTransfer?.files ?? []).find((candidate) => candidate.type.startsWith("image/")); if (file) await this.insertNoteImageFile(file); }
  selectNoteImage(event: MouseEvent): void { const target = event.target; this.selectedNoteImage.set(target instanceof HTMLImageElement ? target : null); }
  resizeSelectedNoteImage(width: number): void { const image = this.selectedNoteImage(); if (!image) return; image.style.width = `${width}%`; image.style.height = "auto"; this.scheduleNoteSave(); }
  selectedNoteImageWidth(): string { return this.selectedNoteImage()?.style.width ?? ""; }
  async deleteNote(note: Note, event?: Event): Promise<void> { event?.stopPropagation(); if (!window.confirm(`¿Eliminar la nota "${note.title}"?`)) return; await this.noteRepository.delete(note.id); this.notes.update((notes) => notes.filter((item) => item.id !== note.id)); if (this.editingNote()?.id === note.id) await this.closeNoteEditor(); }
  notePreview(note: Note): string { const container = document.createElement("div"); container.innerHTML = note.contentHtml; return container.textContent?.replace(/\s+/g, " ").trim() || "Sin contenido todavía"; }
  noteDateLabel(note: Note): string { return new Intl.DateTimeFormat(this.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(note.updatedAt)); }
  private async loadNotes(): Promise<void> {
    const notes = await this.noteRepository.list();
    const emptyNotes = notes.filter((note) => this.isEmptyDefaultNote(note));
    if (emptyNotes.length > 0) await Promise.all(emptyNotes.map((note) => this.noteRepository.delete(note.id)));
    this.notes.set(notes.filter((note) => !this.isEmptyDefaultNote(note)));
  }
  private scheduleNoteSave(): void { if (!this.editingNote()) return; if (this.noteSaveTimer) clearTimeout(this.noteSaveTimer); this.noteSaveTimer = setTimeout(() => void this.saveNoteNow(), 550); }
  private async saveNoteNow(): Promise<void> {
    const note = this.editingNote();
    const editor = this.noteEditor?.nativeElement;
    if (!note || !editor) return;
    if (this.noteSaveTimer) { clearTimeout(this.noteSaveTimer); this.noteSaveTimer = undefined; }

    const title = this.noteTitle();
    const contentHtml = editor.innerHTML;
    if (this.noteIsDraft() && !this.hasMeaningfulNoteContent(title, contentHtml)) return;

    const sequence = ++this.noteSaveSequence;
    this.noteSaving.set(true);
    try {
      const saved = this.noteIsDraft()
        ? await this.noteRepository.create({ title, contentHtml })
        : await this.noteRepository.update(note.id, { title, contentHtml });
      if (sequence === this.noteSaveSequence) {
        this.noteIsDraft.set(false);
        this.editingNote.set(saved);
        this.notes.update((notes) => [saved, ...notes.filter((item) => item.id !== saved.id)]);
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo guardar la nota"), "error");
    } finally {
      if (sequence === this.noteSaveSequence) this.noteSaving.set(false);
    }
  }
  private hasMeaningfulNoteContent(title: string, contentHtml: string): boolean {
    if (title.trim() && title.trim() !== "Nota sin título") return true;
    const container = document.createElement("div");
    container.innerHTML = contentHtml;
    return Boolean(container.textContent?.trim() || container.querySelector("img"));
  }
  private isEmptyDefaultNote(note: Note): boolean { return !this.hasMeaningfulNoteContent(note.title, note.contentHtml); }
  private async insertNoteImageFile(file: File): Promise<void> { if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { this.showNotice("La imagen debe pesar menos de 10 MB", "warning"); return; } const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("No se pudo leer la imagen")); reader.readAsDataURL(file); }); const editor = this.noteEditor?.nativeElement; if (!editor) return; editor.focus(); const image = document.createElement("img"); image.src = dataUrl; image.alt = file.name; image.style.width = "100%"; image.style.height = "auto"; const selection = window.getSelection(); if (selection?.rangeCount) { const range = selection.getRangeAt(0); range.deleteContents(); range.insertNode(image); range.setStartAfter(image); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); } else { editor.append(image); } this.scheduleNoteSave(); }
  private placeNoteCaret(x: number, y: number): void { const range = document.caretRangeFromPoint?.(x, y); if (!range) return; const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }

  @HostListener("window:resize")
  updateCompactTaskLimit(): void {
    if (!this.compactView()) return;

    const availableTaskSpace = window.innerHeight - 190;
    const limit = Math.max(1, Math.min(5, Math.floor(availableTaskSpace / 38)));
    this.compactTaskLimit.set(limit);
  }

  @HostListener("window:keydown", ["$event"])
  handleGlobalSearchShortcut(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      this.closeTopmostModal();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      void this.createNote();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      this.openGlobalSearch();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
      event.preventDefault();
      if (!this.compactView()) void this.minimizeToWidget();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
      event.preventDefault();
      if (this.compactView()) void this.exitCompactView();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.openDatePicker();
      return;
    }

  }

  openDatePicker(): void {
    const input = this.datePicker?.nativeElement;
    if (!input) return;

    input.focus();
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  }

  selectDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) void this.store.load(value as LocalDate);
  }

  private closeTopmostModal(): void {
    if (this.priorityDropConfirmation()) { void this.resolvePriorityDrop(false); return; }
    if (this.pendingTimedCompletion()) { this.cancelTimedCompletion(); return; }
    if (this.deleteConfirmationTask()) { this.cancelTaskDeleteConfirmation(); return; }
    if (this.deleteConfirmationProject()) { this.cancelDeleteConfirmation(); return; }
    if (this.archiveConfirmationProject()) { this.cancelArchiveConfirmation(); return; }
    if (this.completedTaskDetail()) { this.closeCompletedTaskDetail(); return; }
    if (this.viewingSearchTask()) { this.closeSearchTaskDetail(); return; }
    if (this.editingTask()) { this.closeEditor(); return; }
    if (this.editingProject()) { this.closeProjectEditor(); return; }
    if (this.projectCreatorOpen()) { this.projectCreatorOpen.set(false); return; }
    if (this.archivedProjectsOpen()) { void this.toggleArchivedProjects(); return; }
    if (this.noteEditorOpen()) { void this.closeNoteEditor(); return; }
    if (this.appearanceSettingsOpen()) { this.appearanceSettingsOpen.set(false); return; }
    if (this.globalSearchOpen()) { this.closeGlobalSearch(); }
  }

  @HostListener("window:focus")
  async rolloverPendingTasksOnFocus(): Promise<void> {
    if (this.rolloverRefreshInFlight) {
      return;
    }

    this.rolloverRefreshInFlight = true;
    try {
      const movedTaskCount = await this.store.rolloverPendingTasks();
      if (movedTaskCount > 0) {
        this.showNotice(
          `${movedTaskCount} pendiente${movedTaskCount === 1 ? "" : "s"} movido${movedTaskCount === 1 ? "" : "s"} a hoy`,
          "success",
        );
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo actualizar pendientes"), "warning");
    } finally {
      this.rolloverRefreshInFlight = false;
    }
  }

  openGlobalSearch(): void {
    this.globalSearchOpen.set(true);
    void this.loadGlobalSearchCandidates();
  }

  closeGlobalSearch(): void {
    this.globalSearchOpen.set(false);
    this.globalSearchError.set(null);
  }

  async refreshGlobalSearch(): Promise<void> {
    if (!this.globalSearchOpen() || this.globalSearchLoading()) return;

    const value = this.globalSearch.getRawValue();
    const query = value.query.trim();
    let expression: RegExp | null = null;

    if (query) {
      try {
        expression = new RegExp(query, "i");
      } catch {
        this.globalSearchError.set("La expresión regular no es válida");
        return;
      }
    }

    this.globalSearchError.set(null);
    this.globalSearchResults.set(
      this.globalSearchCandidates().filter((task) =>
        (value.status === "all" || task.status === value.status) &&
        (value.priority === "all" || task.priority === value.priority) &&
        (!value.projectId || task.projectId === value.projectId) &&
        (!expression || expression.test(this.globalSearchText(task))),
      ),
    );
    this.globalSearchNoteResults.set(
      query
        ? this.notes().filter((note) => !expression || expression.test(this.globalSearchText(note)))
        : [],
    );
  }

  private async loadGlobalSearchCandidates(): Promise<void> {
    const sequence = ++this.globalSearchSequence;
    let loaded = false;
    this.globalSearchLoading.set(true);
    this.globalSearchError.set(null);

    try {
      const [tasks] = await Promise.all([
        this.taskRepository.listForSearch({ status: null, priority: null, projectId: null }),
        this.loadNotes(),
      ]);
      if (sequence !== this.globalSearchSequence) return;

      this.globalSearchCandidates.set(tasks);
      loaded = true;
    } catch (error) {
      if (sequence === this.globalSearchSequence) {
        this.globalSearchError.set(errorMessage(error, "No se pudo completar la búsqueda"));
      }
    } finally {
      if (sequence === this.globalSearchSequence) {
        this.globalSearchLoading.set(false);
        if (loaded) {
          await this.refreshGlobalSearch();
        }
      }
    }
  }

  async openGlobalSearchResult(task: Task): Promise<void> {
    this.viewingSearchTask.set(task);
  }

  openGlobalSearchNote(note: Note): void {
    this.closeGlobalSearch();
    this.workspaceView.set("ideas");
    this.openNoteEditor(note);
  }

  closeSearchTaskDetail(): void {
    this.viewingSearchTask.set(null);
  }

  async editSearchTask(task: Task): Promise<void> {
    this.closeSearchTaskDetail();
    this.closeGlobalSearch();
    await this.store.selectProject(task.projectId);
    await this.store.load(task.plannedDate);
    this.openEditor(this.store.taskById(task.id) ?? task);
  }

  deleteSearchTask(task: Task): void {
    this.closeSearchTaskDetail();
    this.closeGlobalSearch();
    this.deleteConfirmationTask.set(task);
  }

  private globalSearchText(task: Task): string;
  private globalSearchText(note: Note): string;
  private globalSearchText(task: Task | Note): string {
    if ("contentHtml" in task) {
      return `${task.title} ${this.notePreview(task)}`;
    }
    return [
      task.title,
      task.description ?? "",
      task.projectName ?? "Sin proyecto",
      task.priority,
      priorityLabel(task.priority),
      task.status,
      statusLabel(task.status),
    ].join(" ");
  }

  priorityLabel(priority: TaskPriority): string {
    return priorityLabel(priority);
  }

  statusLabel(status: TaskStatus): string {
    return statusLabel(status);
  }

  async toggleCompactView(): Promise<void> {
    if (this.compactView()) {
      await this.exitCompactView();
      return;
    }

    await this.enterCompactView();
  }

  async minimizeToWidget(): Promise<void> {
    if (!this.compactView()) {
      await this.enterCompactView();
    }
  }

  async minimizeWindow(): Promise<void> {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo minimizar la ventana"), "warning");
    }
  }

  async toggleMaximizeWindow(): Promise<void> {
    if (this.compactView()) {
      await this.exitCompactView();
    }

    try {
      const appWindow = getCurrentWindow();
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo cambiar el tamaño de la ventana"), "warning");
    }
  }

  async closeWindow(): Promise<void> {
    try {
      await this.saveCurrentWindowGeometry(this.compactView() ? "compact" : "full");
      await getCurrentWindow().close();
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo cerrar la ventana"), "warning");
    }
  }

  async startWindowDragging(event: PointerEvent): Promise<void> {
    if (event.button !== 0) return;

    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo mover la ventana"), "warning");
    }
  }

  private async enterCompactView(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();
      const capturedGeometry = await this.captureWindowGeometry();
      this.expandedWindowGeometry = capturedGeometry && this.isUsableWindowGeometry("full", capturedGeometry) ? capturedGeometry : null;
      if (this.expandedWindowGeometry) {
        await this.windowGeometryStorage.save("full", this.expandedWindowGeometry);
      }
      await appWindow.setAlwaysOnTop(true);
      this.compactAlwaysOnTop.set(true);
      this.compactView.set(true);
      if (!await this.restoreWindowGeometry("compact")) {
        await this.resizeCompactWindow();
      }
      this.updateCompactTaskLimit();
    } catch (error) {
      this.compactView.set(false);
      void getCurrentWindow().setAlwaysOnTop(false);
      this.showNotice(errorMessage(error, "No se pudo cambiar el tamaño de la ventana"), "warning");
    }
  }

  private async exitCompactView(): Promise<void> {
    try {
      const appWindow = getCurrentWindow();
      await this.saveCurrentWindowGeometry("compact");
      await appWindow.setAlwaysOnTop(false);
      this.compactAlwaysOnTop.set(true);
      this.compactView.set(false);
      if (!await this.restoreWindowGeometry("full", this.expandedWindowGeometry)) {
        await appWindow.setSize(new LogicalSize(defaultFullWindowWidth, defaultFullWindowHeight));
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo cambiar el tamaño de la ventana"), "warning");
    }
  }

  async selectCompactProject(event: Event): Promise<void> {
    const projectId = (event.target as HTMLSelectElement).value || null;
    await this.selectProject(projectId);
  }

  async toggleCompactAlwaysOnTop(): Promise<void> {
    if (!this.compactView()) {
      return;
    }

    const enabled = !this.compactAlwaysOnTop();
    try {
      await getCurrentWindow().setAlwaysOnTop(enabled);
      this.compactAlwaysOnTop.set(enabled);
      this.showNotice(enabled ? "Widget siempre visible" : "Widget puede quedar detrás", "success");
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo cambiar la prioridad de ventana"), "warning");
    }
  }

  private async resizeCompactWindow(activeTaskCount = this.store.activeTasks().length): Promise<void> {
    const visibleTaskCount = Math.min(activeTaskCount, 5);
    const height = visibleTaskCount === 0 ? 300 : Math.max(250, 210 + visibleTaskCount * 38);
    await getCurrentWindow().setSize(new LogicalSize(330, height));
  }

  private async captureWindowGeometry(): Promise<WindowGeometry | null> {
    const appWindow = getCurrentWindow();
    if (await appWindow.isMaximized()) {
      return null;
    }

    const [size, position] = await Promise.all([appWindow.innerSize(), appWindow.outerPosition()]);
    return { width: size.width, height: size.height, x: position.x, y: position.y };
  }

  private async saveCurrentWindowGeometry(mode: WindowMode): Promise<void> {
    const geometry = await this.captureWindowGeometry();
    if (geometry) {
      await this.windowGeometryStorage.save(mode, geometry);
    }
  }

  private async restoreWindowGeometry(mode: WindowMode, fallback: WindowGeometry | null = null): Promise<boolean> {
    const geometry = fallback ?? await this.windowGeometryStorage.load(mode);
    if (!geometry || !this.isUsableWindowGeometry(mode, geometry)) {
      return false;
    }

    const monitors = await availableMonitors();
    const targetMonitor = this.monitorForGeometry(geometry, monitors) ?? await currentMonitor() ?? monitors[0];
    const visibleGeometry = targetMonitor ? this.constrainToMonitor(geometry, targetMonitor) : geometry;
    const appWindow = getCurrentWindow();
    await appWindow.setSize(new PhysicalSize(visibleGeometry.width, visibleGeometry.height));
    await appWindow.setPosition(new PhysicalPosition(visibleGeometry.x, visibleGeometry.y));
    return true;
  }

  private isUsableWindowGeometry(mode: WindowMode, geometry: WindowGeometry): boolean {
    return mode === "compact" || (geometry.width >= minimumFullWindowWidth && geometry.height >= minimumFullWindowHeight);
  }

  private monitorForGeometry(geometry: WindowGeometry, monitors: readonly Monitor[]): Monitor | null {
    const centerX = geometry.x + geometry.width / 2;
    const centerY = geometry.y + geometry.height / 2;
    return monitors.find((monitor) => {
      const { position, size } = monitor.workArea;
      return centerX >= position.x && centerX < position.x + size.width &&
        centerY >= position.y && centerY < position.y + size.height;
    }) ?? null;
  }

  private constrainToMonitor(geometry: WindowGeometry, monitor: Monitor): WindowGeometry {
    const { position, size } = monitor.workArea;
    const width = Math.min(geometry.width, size.width);
    const height = Math.min(geometry.height, size.height);
    return {
      width,
      height,
      x: Math.min(Math.max(geometry.x, position.x), position.x + size.width - width),
      y: Math.min(Math.max(geometry.y, position.y), position.y + size.height - height),
    };
  }

  async addQuickTask(): Promise<void> {
    const title = this.quickTask.value;
    if (!title.trim()) {
      return;
    }

    const task = await this.store.createQuickTask(title);
    this.quickTask.reset();
    this.showNotice("Tarea agregada", "success", () => this.store.delete(task.id));
  }

  async drop(event: CdkDragDrop<unknown>): Promise<void> {
    const visibleTasks = this.store.activeTasks();
    const movedTask = visibleTasks[event.previousIndex];
    const movedToFirst = event.currentIndex === 0 && event.previousIndex !== 0;
    if (!movedTask) {
      return;
    }

    if (movedToFirst && movedTask.priority !== "high") {
      this.priorityDropConfirmation.set({
        task: movedTask,
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex,
      });
      return;
    }

    await this.applyDrop(movedTask, event.previousIndex, event.currentIndex, false);
  }

  canMoveTask(task: Task, direction: -1 | 1): boolean {
    if (this.compactView() || this.activePriorityFilter() !== "all" || this.store.saving()) {
      return false;
    }

    const index = this.store.activeTasks().findIndex((candidate) => candidate.id === task.id);
    return index !== -1 && index + direction >= 0 && index + direction < this.store.activeTasks().length;
  }

  async moveTask(task: Task, direction: -1 | 1): Promise<void> {
    if (!this.canMoveTask(task, direction)) {
      return;
    }

    const previousIndex = this.store.activeTasks().findIndex((candidate) => candidate.id === task.id);
    const currentIndex = previousIndex + direction;

    if (currentIndex === 0 && task.priority !== "high") {
      this.priorityDropConfirmation.set({ task, previousIndex, currentIndex });
      return;
    }

    await this.applyDrop(task, previousIndex, currentIndex, false);
  }

  async resolvePriorityDrop(markHigh: boolean): Promise<void> {
    const pendingDrop = this.priorityDropConfirmation();
    if (!pendingDrop) {
      return;
    }

    this.priorityDropConfirmation.set(null);
    await this.applyDrop(
      pendingDrop.task,
      pendingDrop.previousIndex,
      pendingDrop.currentIndex,
      markHigh,
    );
  }

  openTaskDeleteConfirmation(id: string): void {
    const task = this.store.taskById(id);
    if (task) {
      this.deleteConfirmationTask.set(task);
    }
  }

  cancelTaskDeleteConfirmation(): void {
    this.deleteConfirmationTask.set(null);
  }

  async confirmTaskDelete(): Promise<void> {
    const task = this.deleteConfirmationTask();
    if (!task) {
      return;
    }

    this.deleteConfirmationTask.set(null);
    const evidence = await this.evidenceRepository.listForTask(task.id);
    await this.store.delete(task.id);
    let restoreRequested = false;
    this.showNotice("Tarea eliminada", "success", async () => {
      restoreRequested = true;
      await this.store.restoreTask(task);
      await Promise.all(evidence.map((item) => this.evidenceRepository.restore(item)));
    });
    this.removeEvidenceAfterUndoWindow(evidence, () => restoreRequested);
  }

  private async applyDrop(
    movedTask: Task,
    previousIndex: number,
    currentIndex: number,
    shouldPrioritize: boolean,
  ): Promise<void> {
    if (shouldPrioritize) {
      await this.store.updateTask(movedTask.id, {
        title: movedTask.title,
        description: movedTask.description,
        projectId: movedTask.projectId,
        priority: "high",
        plannedDate: movedTask.plannedDate,
        estimatedMinutes: movedTask.estimatedMinutes,
        actualMinutes: movedTask.actualMinutes,
      });
    }

    await this.store.reorder(previousIndex, currentIndex);

    if (shouldPrioritize) {
      this.showNotice("Tarea movida y marcada como prioritaria", "success", async () => {
        await this.store.updateTask(movedTask.id, {
          title: movedTask.title,
          description: movedTask.description,
          projectId: movedTask.projectId,
          priority: movedTask.priority,
          plannedDate: movedTask.plannedDate,
          estimatedMinutes: movedTask.estimatedMinutes,
          actualMinutes: movedTask.actualMinutes,
        });
        await this.store.reorder(currentIndex, previousIndex);
      });
    }
  }

  async completeTask(id: string): Promise<void> {
    const task = this.store.taskById(id);
    if (task?.startedAt) {
      const elapsedMinutes = Math.max(1, Math.ceil((Date.now() - Date.parse(task.startedAt)) / 60_000));
      this.pendingTimedCompletion.set({ task, elapsedMinutes });
      return;
    }

    await this.completeTaskNow(task ?? null, false);
  }

  cancelTimedCompletion(): void {
    this.pendingTimedCompletion.set(null);
  }

  async resolveTimedCompletion(recordElapsedTime: boolean): Promise<void> {
    const pendingCompletion = this.pendingTimedCompletion();
    if (!pendingCompletion) {
      return;
    }

    this.pendingTimedCompletion.set(null);
    await this.completeTaskNow(pendingCompletion.task, recordElapsedTime, pendingCompletion.elapsedMinutes);
  }

  private async completeTaskNow(
    task: Task | null,
    recordElapsedTime: boolean,
    elapsedMinutes = 0,
  ): Promise<void> {
    if (!task) {
      return;
    }

    if (recordElapsedTime) {
      await this.store.updateTimeTracking(task.id, (task.actualMinutes ?? 0) + elapsedMinutes, null);
    }
    await this.store.complete(task.id);
    this.showNotice("Tarea completada", "success", async () => {
      await this.store.reopen(task.id);
      if (task.startedAt) {
        await this.restoreTimeTracking(task);
      }
    });
  }

  async reopenTask(id: string): Promise<void> {
    await this.store.reopen(id);
    this.showNotice("Tarea reabierta", "success", () => this.store.complete(id));
  }

  async openCompletedTaskDetail(task: Task): Promise<void> {
    this.completedTaskDetail.set(task);
    this.completedTaskEvidence.set([]);
    this.completedTaskEvidenceUrls.set({});
    const evidence = await this.evidenceRepository.listForTask(task.id);
    if (this.completedTaskDetail()?.id !== task.id) {
      return;
    }
    this.completedTaskEvidence.set(evidence);
    const urls = await Promise.all(
      evidence.map(async (item) => [item.id, await this.evidenceStorage.imageUrl(item.relativePath)] as const),
    );
    if (this.completedTaskDetail()?.id === task.id) {
      this.completedTaskEvidenceUrls.set(Object.fromEntries(urls));
    }
  }

  closeCompletedTaskDetail(): void {
    this.completedTaskDetail.set(null);
    this.completedTaskEvidence.set([]);
    this.completedTaskEvidenceUrls.set({});
  }

  completedAtLabel(completedAt: string | null): string {
    if (!completedAt) {
      return "Sin fecha registrada";
    }
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(completedAt));
  }

  async changeTaskPriority(task: Task): Promise<void> {
    const nextPriority: Record<TaskPriority, TaskPriority> = { high: "medium", medium: "low", low: "high" };
    const previousPriority = task.priority;
    const priority = nextPriority[previousPriority];
    const draft = {
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      plannedDate: task.plannedDate,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
    };

    await this.store.updateTask(task.id, { ...draft, priority });
    this.showNotice(`Prioridad cambiada a ${priorityLabel(priority)}`, "success", () =>
      this.store.updateTask(task.id, { ...draft, priority: previousPriority }),
    );
  }

  async toggleTimeTracking(task: Task): Promise<void> {
    if (task.startedAt) {
      const elapsedMinutes = Math.max(1, Math.ceil((Date.now() - Date.parse(task.startedAt)) / 60_000));
      const actualMinutes = (task.actualMinutes ?? 0) + elapsedMinutes;
      await this.store.updateTimeTracking(task.id, actualMinutes, null);
      this.showNotice("Temporizador detenido", "success", () => this.restoreTimeTracking(task));
      return;
    }

    await this.store.updateTimeTracking(task.id, task.actualMinutes, new Date().toISOString());
    this.showNotice("Temporizador iniciado", "success", () => this.restoreTimeTracking(task));
  }

  timeLabel(task: Task): string {
    const elapsedMinutes = task.startedAt
      ? Math.max(1, Math.ceil((this.trackingNow() - Date.parse(task.startedAt)) / 60_000))
      : 0;
    const minutes = (task.actualMinutes ?? 0) + elapsedMinutes;
    return task.startedAt ? `${minutes} min acumulados · En curso` : `${minutes} min reales`;
  }

  statisticsTimeLabel(minutes: number | null): string {
    return minutes === null ? "Sin registro" : `${minutes} min`;
  }

  statisticsComparisonLabel(statistics: TaskStatistics): string {
    if (statistics.comparableTaskCount === 0) {
      return "Sin pares";
    }

    return `${statistics.comparableEstimatedMinutes} / ${statistics.comparableActualMinutes} min`;
  }

  statisticsTrendLabel(trend: TaskTrend): string {
    return `${trend.completedTaskCount} completadas · ${this.statisticsTimeLabel(trend.actualMinutes)}`;
  }

  chartData(): readonly TaskDailyTrend[] {
    const data = this.store.dailyTrend();
    return data.slice(Math.max(0, data.length - this.chartRange()));
  }

  chartMaxValue(): number {
    return Math.max(
      1,
      ...this.chartData().map((point) => Math.max(
        point.plannedTaskCount,
        point.completedTaskCount,
        point.postponedTaskCount,
      )),
    );
  }

  chartPoints(metric: "plannedTaskCount" | "completedTaskCount" | "postponedTaskCount"): string {
    const points = this.chartData();
    const denominator = Math.max(1, points.length - 1);
    const maxValue = this.chartMaxValue();
    return points
      .map((point, index) => {
        const x = 28 + (index / denominator) * 664;
        const y = 96 - (point[metric] / maxValue) * 72;
        return `${x},${y}`;
      })
      .join(" ");
  }

  chartPointX(index: number): number {
    return 28 + (index / Math.max(1, this.chartData().length - 1)) * 664;
  }

  chartPointY(value: number): number {
    return 96 - (value / this.chartMaxValue()) * 72;
  }

  chartDateLabel(date: string): string {
    return date.slice(5).replace("-", "/");
  }

  chartLabelPoints(): readonly TaskDailyTrend[] {
    const points = this.chartData();
    if (points.length <= 3) {
      return points;
    }
    return [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]];
  }

  beginInlineTaskTitle(task: Task): void {
    this.inlineTaskTitleId.set(task.id);
    this.inlineTaskTitle.setValue(task.title);
  }

  cancelInlineTaskTitle(): void {
    this.inlineTaskTitleId.set(null);
  }

  async saveInlineTaskTitle(task: Task): Promise<void> {
    if (this.inlineTaskTitleId() !== task.id) return;
    const title = this.inlineTaskTitle.value.trim();
    this.inlineTaskTitleId.set(null);
    if (!title || title === task.title) return;

    const draft = {
      description: task.description,
      projectId: task.projectId,
      priority: task.priority,
      plannedDate: task.plannedDate,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
    };
    await this.store.updateTask(task.id, { ...draft, title });
    this.showNotice("Tarea renombrada", "success", () => this.store.updateTask(task.id, { ...draft, title: task.title }));
  }

  beginInlineProjectTitle(project: Project): void {
    this.inlineProjectTitleId.set(project.id);
    this.inlineProjectTitle.setValue(project.name);
  }

  cancelInlineProjectTitle(): void {
    this.inlineProjectTitleId.set(null);
  }

  async saveInlineProjectTitle(project: Project): Promise<void> {
    if (this.inlineProjectTitleId() !== project.id) return;
    const name = this.inlineProjectTitle.value.trim();
    this.inlineProjectTitleId.set(null);
    if (!name || name === project.name) return;

    const draft = {
      name,
      color: project.color,
      iconName: project.iconName,
      logoRelativePath: project.logoRelativePath,
    };
    await this.projectRepository.update(project.id, draft);
    await this.loadProjects();
    this.showNotice("Proyecto renombrado", "success", async () => {
      await this.projectRepository.update(project.id, { ...draft, name: project.name });
      await this.loadProjects();
    });
  }

  async selectProject(projectId: string | null): Promise<void> {
    this.workspaceView.set("tasks");
    this.closeProjectActions();
    await this.store.selectProject(projectId);
  }

  toggleProjectActions(project: Project, event: MouseEvent): void {
    event.stopPropagation();
    if (this.projectActionsOpenFor() === project.id) {
      this.closeProjectActions();
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.projectActionsOpenFor.set(project.id);
    this.projectActionsPosition.set({ top: rect.bottom + 6, left: Math.max(8, rect.right - 150) });
  }

  openProjectContextMenu(project: Project, event: MouseEvent): void {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    this.projectActionsPosition.set({ top: event.clientY, left: Math.max(8, Math.min(event.clientX, window.innerWidth - 158)) });
    this.projectActionsOpenFor.set(project.id);
  }

  openRailContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const projectRow = (event.target as HTMLElement).closest<HTMLElement>('.folder-row');
    const projectId = projectRow ? this.projectForIdFromRow(projectRow) : null;
    const project = projectId ? this.projectForId(projectId) : null;
    if (!project) {
      this.closeProjectActions();
      return;
    }

    this.projectActionsPosition.set({ top: event.clientY, left: Math.max(8, Math.min(event.clientX, window.innerWidth - 158)) });
    this.projectActionsOpenFor.set(project.id);
  }

  handleWorkspaceContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (target.closest(".global-project-menu")) {
      return;
    }

    if (target.closest(".project-rail")) {
      return;
    }

    const project = target.closest(".project-banner") ? this.selectedProject() : null;
    if (project) {
      this.projectActionsPosition.set({ top: event.clientY, left: Math.max(8, Math.min(event.clientX, window.innerWidth - 158)) });
      this.projectActionsOpenFor.set(project.id);
    } else {
      this.closeProjectActions();
    }
  }

  handleWorkspaceClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest(".global-project-menu") && !target.closest(".folder-settings") && !target.closest(".project-settings")) {
      this.closeProjectActions();
    }
  }

  private projectForIdFromRow(row: HTMLElement): string | null {
    return row.dataset["projectId"] ?? null;
  }

  closeProjectActions(): void {
    this.projectActionsOpenFor.set(null);
    this.projectActionsPosition.set(null);
  }

  editProjectFromMenu(project: Project): void {
    this.closeProjectActions();
    this.openProjectEditor(project);
  }

  openArchiveConfirmation(project: Project): void {
    this.closeProjectActions();
    this.archiveConfirmationProject.set(project);
  }

  cancelArchiveConfirmation(): void {
    this.archiveConfirmationProject.set(null);
  }

  async confirmArchiveProject(): Promise<void> {
    const project = this.archiveConfirmationProject();
    if (!project) return;
    this.archiveConfirmationProject.set(null);
    try {
      await this.projectRepository.archive(project.id);
      if (this.store.selectedProjectId() === project.id) await this.store.selectProject(null);
      await this.loadProjects();
      this.closeProjectEditor();
      this.showNotice("Proyecto archivado", "success", async () => {
        await this.projectRepository.unarchive(project.id);
        await this.loadProjects();
      });
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo archivar el proyecto"), "error");
    }
  }

  openDeleteConfirmation(project: Project): void {
    this.closeProjectActions();
    this.deleteConfirmation.reset();
    this.deleteConfirmationProject.set(project);
  }

  cancelDeleteConfirmation(): void {
    this.deleteConfirmationProject.set(null);
    this.deleteConfirmation.reset();
  }

  async confirmDeleteProject(): Promise<void> {
    const project = this.deleteConfirmationProject();
    if (!project || this.deleteConfirmation.value.trim() !== project.name) return;
    this.cancelDeleteConfirmation();
    try {
      await this.projectRepository.delete(project.id);
      if (this.store.selectedProjectId() === project.id) await this.store.selectProject(null);
      await this.loadProjects();
      this.showNotice("Proyecto eliminado", "success", async () => {
        await this.projectRepository.restoreDeleted(project.id);
        await this.loadProjects();
      });
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo eliminar el proyecto"), "error");
    }
  }

  async toggleArchivedProjects(): Promise<void> {
    this.archivedProjectsOpen.update((open) => !open);
    if (this.archivedProjectsOpen()) {
      this.archivedProjects.set(await this.projectRepository.listArchived());
    }
  }

  async unarchiveProject(project: Project): Promise<void> {
    await this.projectRepository.unarchive(project.id);
    await Promise.all([this.loadProjects(), this.toggleArchivedProjects()]);
    this.showNotice("Proyecto desarchivado", "success", async () => {
      await this.projectRepository.archive(project.id);
      await this.loadProjects();
      this.archivedProjects.set(await this.projectRepository.listArchived());
    });
  }

  openEditor(task: Task): void {
    this.editingTask.set(task);
    void this.loadEvidence(task.id);
    this.editor.setValue({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      plannedDate: task.plannedDate,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      projectId: task.projectId,
    });
  }

  closeEditor(): void {
    this.editingTask.set(null);
    this.taskEvidence.set([]);
    this.evidenceUrls.set({});
    this.creatingProject.set(false);
    this.editor.reset({
      title: "",
      description: "",
      priority: "medium",
      plannedDate: this.store.selectedDate(),
      estimatedMinutes: null,
      actualMinutes: null,
      projectId: null,
    });
    this.newProject.reset({ name: "", color: this.projectColors[0] });
    this.resetProjectIdentity();
  }

  async saveEdit(): Promise<void> {
    const task = this.editingTask();
    const value = this.editor.getRawValue();
    if (!task || !value.title.trim()) {
      return;
    }

    await this.store.updateTask(task.id, {
      title: value.title,
      description: value.description,
      projectId: value.projectId,
      priority: value.priority,
      plannedDate: value.plannedDate,
      estimatedMinutes: value.estimatedMinutes,
      actualMinutes: value.actualMinutes,
    });
    this.closeEditor();
    this.showNotice("Cambios guardados", "success", () =>
      this.store.updateTask(task.id, {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        priority: task.priority,
        plannedDate: task.plannedDate,
        estimatedMinutes: task.estimatedMinutes,
        actualMinutes: task.actualMinutes,
      }),
    );
  }

  evidenceUrl(evidence: Evidence): string | null {
    return this.evidenceUrls()[evidence.id] ?? null;
  }

  async attachEvidence(task: Task): Promise<void> {
    try {
      const selection = await this.evidenceStorage.selectImage();
      if (!selection) {
        return;
      }

      const relativePath = await this.evidenceStorage.saveImage(selection, task.id);
      let evidence: Evidence;
      try {
        evidence = await this.evidenceRepository.create({
          taskId: task.id,
          relativePath,
          originalName: selection.originalName,
          mimeType: selection.mimeType,
          sizeBytes: selection.sizeBytes,
        });
      } catch (error) {
        await this.evidenceStorage.removeImage(relativePath).catch(() => undefined);
        throw error;
      }
      await this.loadEvidence(task.id);
      this.showNotice("Evidencia adjuntada", "success", async () => {
        await this.evidenceRepository.delete(evidence.id);
        await this.evidenceStorage.removeImage(evidence.relativePath);
        await this.loadEvidence(task.id);
      });
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo adjuntar la evidencia"), "error");
    }
  }

  async deleteEvidence(task: Task, evidence: Evidence): Promise<void> {
    try {
      await this.evidenceRepository.delete(evidence.id);
      await this.loadEvidence(task.id);
      let restoreRequested = false;
      this.showNotice("Evidencia eliminada", "success", async () => {
        restoreRequested = true;
        await this.evidenceRepository.restore(evidence);
        await this.loadEvidence(task.id);
      });
      this.removeEvidenceAfterUndoWindow([evidence], () => restoreRequested);
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo eliminar la evidencia"), "error");
    }
  }

  async createProjectForTask(): Promise<void> {
    const project = await this.persistProject();
    if (!project) {
      return;
    }

    this.editor.controls.projectId.setValue(project.id);
    this.creatingProject.set(false);
    this.showNotice("Proyecto creado y seleccionado", "success", async () => {
      await this.projectRepository.delete(project.id);
      await this.loadProjects();
      this.editor.controls.projectId.setValue(null);
    });
  }

  openProjectCreator(): void {
    this.newProject.reset({ name: "", color: this.projectColors[0], iconName: "folder-kanban" });
    this.resetProjectIdentity();
    this.projectCreatorOpen.set(true);
  }

  openProjectEditor(project: Project): void {
    this.editingProject.set(project);
    this.projectEditor.setValue({
      name: project.name,
      color: project.color,
      iconName: this.isProjectIcon(project.iconName) ? project.iconName : "folder-kanban",
    });
    this.projectEditorIdentityMode.set(project.logoRelativePath ? "logo" : "icon");
    this.selectedEditedProjectLogo.set(null);
    this.selectedEditedProjectLogoPreviewUrl.set(null);
  }

  closeProjectEditor(): void {
    this.editingProject.set(null);
    this.projectEditor.reset({ name: "", color: this.projectColors[0], iconName: "folder-kanban" });
    this.projectEditorIdentityMode.set("icon");
    this.selectedEditedProjectLogo.set(null);
    this.selectedEditedProjectLogoPreviewUrl.set(null);
  }

  async selectProjectLogoForEditor(): Promise<void> {
    try {
      const selection = await this.projectIdentityStorage.selectLogo();
      if (selection) {
        this.selectedEditedProjectLogo.set(selection);
        this.selectedEditedProjectLogoPreviewUrl.set(await this.projectIdentityStorage.previewUrl(selection));
        this.projectEditorIdentityMode.set("logo");
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo usar esa imagen"), "error");
    }
  }

  async saveProjectEdit(): Promise<void> {
    const project = this.editingProject();
    const value = this.projectEditor.getRawValue();
    if (!project || !value.name.trim()) {
      return;
    }

    let newLogoRelativePath: string | null = null;
    try {
      let logoRelativePath = project.logoRelativePath;
      if (this.projectEditorIdentityMode() === "logo") {
        const selection = this.selectedEditedProjectLogo();
        if (selection) {
          newLogoRelativePath = await this.projectIdentityStorage.saveLogo(selection);
          logoRelativePath = newLogoRelativePath;
        } else if (!logoRelativePath) {
          this.showNotice("Elige una imagen para usarla como logo", "warning");
          return;
        }
      } else {
        logoRelativePath = null;
      }

      await this.projectRepository.update(
        project.id,
        normalizeProjectDraft({
          name: value.name,
          color: value.color,
          iconName: this.projectEditorIdentityMode() === "icon" ? value.iconName : null,
          logoRelativePath,
        }),
      );
      await this.loadProjects();
      this.closeProjectEditor();
      this.showNotice("Proyecto actualizado", "success", async () => {
        await this.projectRepository.update(project.id, {
          name: project.name,
          color: project.color,
          iconName: project.iconName,
          logoRelativePath: project.logoRelativePath,
        });
        await this.loadProjects();
      });
    } catch (error) {
      if (newLogoRelativePath) {
        await this.projectIdentityStorage.removeLogo(newLogoRelativePath).catch(() => undefined);
      }
      this.showNotice(errorMessage(error, "No se pudo actualizar el proyecto"), "error");
    }
  }

  async selectProjectLogo(): Promise<void> {
    try {
      const selection = await this.projectIdentityStorage.selectLogo();
      if (selection) {
        this.selectedProjectLogo.set(selection);
        this.selectedProjectLogoPreviewUrl.set(await this.projectIdentityStorage.previewUrl(selection));
        this.projectIdentityMode.set("logo");
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo usar esa imagen"), "error");
    }
  }

  async createProjectFromRail(): Promise<void> {
    const project = await this.persistProject();
    if (!project) {
      return;
    }

    this.projectCreatorOpen.set(false);
    await this.store.selectProject(project.id);
    this.showNotice("Proyecto creado", "success", async () => {
      await this.projectRepository.delete(project.id);
      await this.loadProjects();
      await this.store.selectProject(null);
    });
  }

  private async persistProject(): Promise<Project | null> {
    const value = this.newProject.getRawValue();
    if (!value.name.trim()) {
      return null;
    }

    let logoRelativePath: string | null = null;
    try {
      if (this.projectIdentityMode() === "logo") {
        const selection = this.selectedProjectLogo();
        if (!selection) {
          this.showNotice("Elige una imagen para usarla como logo", "warning");
          return null;
        }
        logoRelativePath = await this.projectIdentityStorage.saveLogo(selection);
      }

      const project = await this.projectRepository.create(
        normalizeProjectDraft({
          name: value.name,
          color: value.color,
          iconName: this.projectIdentityMode() === "icon" ? value.iconName : null,
          logoRelativePath,
        }),
      );
      await this.loadProjects();
      this.newProject.reset({ name: "", color: this.projectColors[0], iconName: "folder-kanban" });
      this.resetProjectIdentity();
      return project;
    } catch (error) {
      if (logoRelativePath) {
        await this.projectIdentityStorage.removeLogo(logoRelativePath).catch(() => undefined);
      }
      this.showNotice(error instanceof Error ? error.message : "No se pudo crear el proyecto", "error");
      return null;
    }
  }

  private async restoreTimeTracking(task: Task): Promise<void> {
    await this.store.updateTimeTracking(task.id, task.actualMinutes, task.startedAt);
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  async undoNotice(): Promise<void> {
    const undo = this.notice()?.undo;
    if (!undo) {
      return;
    }

    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }
    this.notice.set(null);

    try {
      await undo();
      this.showNotice("Acción deshecha", "success");
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo deshacer la acción"), "error");
    }
  }

  private showNotice(message: string, tone: NoticeTone, undo?: () => Promise<void>): void {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }

    this.notice.set({ message, tone, undo });
    this.noticeTimer = setTimeout(() => this.notice.set(null), 3200);
  }

  private removeEvidenceAfterUndoWindow(
    evidence: readonly Evidence[],
    restoreRequested: () => boolean,
  ): void {
    if (evidence.length === 0) {
      return;
    }

    setTimeout(() => {
      if (restoreRequested()) {
        return;
      }
      void Promise.all(evidence.map((item) => this.evidenceStorage.removeImage(item.relativePath).catch(() => undefined)));
    }, 3200);
  }

  private async initialize(): Promise<void> {
    try {
      if (!await this.restoreWindowGeometry("full")) {
        await getCurrentWindow().setSize(new LogicalSize(defaultFullWindowWidth, defaultFullWindowHeight));
      }
    } catch (error) {
      this.showNotice(errorMessage(error, "No se pudo restaurar la ventana"), "warning");
    }
    await Promise.all([this.store.initialize(), this.loadProjects(), this.loadAppearanceSettings(), this.loadNotificationSettings()]);
  }

  private async loadAppearanceSettings(): Promise<void> {
    const settings = await this.appearanceSettingsStorage.load() ?? defaultAppearanceSettings;
    this.systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemThemeMediaQuery.addEventListener("change", this.handleSystemThemeChange);
    this.applyAppearance(settings);
    this.appearanceSettings.set(settings);
  }

  private persistAppearance(settings: AppearanceSettings): void {
    this.applyAppearance(settings);
    this.appearanceSettings.set(settings);
    void this.appearanceSettingsStorage.save(settings).catch((error) => {
      this.showNotice(errorMessage(error, "No se pudo guardar la apariencia"), "error");
    });
  }

  private async loadNotificationSettings(): Promise<void> {
    this.notificationSettings.set(await this.notificationSettingsStorage.load() ?? defaultNotificationSettings);
  }

  private persistNotificationSettings(settings: NotificationSettings): void {
    this.notificationSettings.set(settings);
    void this.notificationSettingsStorage.save(settings).catch((error) => {
      this.showNotice(errorMessage(error, "No se pudieron guardar las notificaciones"), "error");
    });
  }

  private applyAppearance(settings: AppearanceSettings): void {
    const resolvedMode = settings.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      : settings.mode;
    const palette = settings[resolvedMode];
    const root = document.documentElement.style;
    root.setProperty("--canvas", palette.canvas);
    root.setProperty("--surface", palette.surface);
    root.setProperty("--surface-raised", palette.surfaceRaised);
    root.setProperty("--ink", palette.ink);
    root.setProperty("--muted", palette.muted);
    root.setProperty("--line", palette.line);
    root.setProperty("--line-strong", palette.lineStrong);
    root.setProperty("--accent", palette.accent);
    root.setProperty("--planned-line", palette.plannedLine);
    root.setProperty("--focus", palette.focus);
    root.setProperty("--action-surface", palette.actionSurface);
    root.setProperty("--action-ink", palette.actionInk);
  }

  private async loadProjects(): Promise<void> {
    const projects = await this.projectRepository.listActive();
    this.projects.set(projects);
    const logoUrls = await Promise.all(
      projects
        .filter((project) => project.logoRelativePath)
        .map(async (project) => [project.id, await this.projectIdentityStorage.logoUrl(project.logoRelativePath!)] as const),
    );
    this.projectLogoUrls.set(Object.fromEntries(logoUrls));
  }

  private async loadEvidence(taskId: string): Promise<void> {
    const evidence = await this.evidenceRepository.listForTask(taskId);
    if (this.editingTask()?.id !== taskId) {
      return;
    }
    this.taskEvidence.set(evidence);
    const urls = await Promise.all(
      evidence.map(async (item) => [item.id, await this.evidenceStorage.imageUrl(item.relativePath)] as const),
    );
    if (this.editingTask()?.id === taskId) {
      this.evidenceUrls.set(Object.fromEntries(urls));
    }
  }

  private resetProjectIdentity(): void {
    this.projectIdentityMode.set("icon");
    this.selectedProjectLogo.set(null);
    this.selectedProjectLogoPreviewUrl.set(null);
  }

  private isProjectIcon(iconName: string | null): iconName is (typeof this.projectIcons)[number] {
    return iconName !== null && this.projectIcons.includes(iconName as (typeof this.projectIcons)[number]);
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" && error.trim() ? error : fallback;
}

function priorityLabel(priority: TaskPriority): string {
  return priority === "high" ? "alta" : priority === "low" ? "baja" : "media";
}

function statusLabel(status: TaskStatus): string {
  return status === "completed" ? "completada" : "pendiente";
}
