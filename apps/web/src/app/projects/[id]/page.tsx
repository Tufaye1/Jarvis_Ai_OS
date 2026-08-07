"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  createTask,
  deleteProject,
  getProject,
  isApiError,
  listTasks,
  updateProject,
  updateTask,
  type ProjectDetail,
  type Task,
  type TaskStatus,
} from "@/lib/api";

function friendlyError(err: unknown): string {
  if (isApiError(err)) {
    if (err.isOffline) return "Can't reach the API. Is it running?";
    if (err.isUnconfigured) return "API is up but not configured yet.";
    return err.detail ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  todo: "doing",
  doing: "done",
  done: "todo",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "In progress",
  done: "Done",
};

export default function ProjectDetailPage() {
  const rawParams = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(rawParams?.id);
  const validId = Number.isFinite(projectId) && projectId > 0;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "status" | "delete" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (pid: number) => {
    setLoadError(null);
    try {
      const [p, ts] = await Promise.all([
        getProject(pid),
        listTasks({ project_id: pid }),
      ]);
      setProject(p);
      setTasks(ts);
    } catch (err) {
      setLoadError(friendlyError(err));
    }
  }, []);

  useEffect(() => {
    if (!validId) return;
    void load(projectId);
  }, [validId, projectId, load]);

  if (!validId) {
    return (
      <div className="max-w-[1180px] px-11 pt-10 pb-7">
        <div className="text-[15px] font-bold text-ink">Invalid project id</div>
        <Link
          href="/projects"
          className="mt-2 inline-block text-[12.5px] font-bold text-accent"
        >
          ← Back to projects
        </Link>
      </div>
    );
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = taskTitle.trim();
    if (!trimmed) {
      setTaskError("Give the task a title.");
      return;
    }
    setTaskSubmitting(true);
    setTaskError(null);
    try {
      const dueIso = taskDue.trim().length > 0 ? isoFromDateInput(taskDue) : null;
      await createTask({
        title: trimmed,
        project_id: projectId,
        due_at: dueIso,
      });
      setTaskTitle("");
      setTaskDue("");
      setShowTaskForm(false);
      await load(projectId);
    } catch (err) {
      setTaskError(friendlyError(err));
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function cycleStatus(task: Task) {
    const next = NEXT_STATUS[task.status];
    setBusyAction("status");
    setActionError(null);
    try {
      const updated = await updateTask(task.id, { status: next });
      setTasks((prev) =>
        prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev,
      );
      if (project) {
        // reload counts
        try {
          const p = await getProject(projectId);
          setProject(p);
        } catch {
          /* non-fatal */
        }
      }
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleArchive() {
    if (!project) return;
    const nextStatus = project.status === "active" ? "archived" : "active";
    setMenuOpen(false);
    setActionError(null);
    try {
      const updated = await updateProject(project.id, { status: nextStatus });
      setProject((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      setActionError(friendlyError(err));
    }
  }

  async function onDelete() {
    if (!project) return;
    setBusyAction("delete");
    setActionError(null);
    try {
      await deleteProject(project.id);
      router.push("/projects");
    } catch (err) {
      setActionError(friendlyError(err));
      setBusyAction(null);
    }
  }

  return (
    <div className="max-w-[1180px] px-11 pt-10 pb-7">
      <Link
        href="/projects"
        className="mb-4 inline-block text-[12.5px] font-bold text-ink-muted-2 hover:text-accent"
      >
        ← Projects
      </Link>

      {loadError && (
        <div className="mb-[18px] rounded-card border border-border-card bg-surface px-5 py-4 text-[13px] font-semibold text-accent-deep">
          {loadError}
        </div>
      )}

      {!project && !loadError && (
        <div className="text-[13.5px] text-ink-muted-2">Loading…</div>
      )}

      {project && (
        <>
          {/* Title row */}
          <div className="flex items-end gap-3">
            <h1 className="text-[34px] font-bold tracking-[-1.2px] text-ink">
              {project.name}
            </h1>
            {project.status === "active" ? (
              <span className="mb-[6px] flex-none rounded-[7px] bg-success-bg px-[9px] py-1 text-[12px] font-semibold text-success">
                Active
              </span>
            ) : (
              <span className="mb-[6px] flex-none rounded-[7px] bg-muted-2 px-[9px] py-1 text-[12px] font-semibold text-ink-muted">
                Archived
              </span>
            )}

            <div className="relative ml-auto">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border-card bg-surface text-[16px] leading-none text-ink hover:border-ink"
              >
                <span aria-hidden>…</span>
                <span className="sr-only">Project actions</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-10 mt-2 w-[220px] overflow-hidden rounded-tile border border-border-card bg-surface shadow-[0_18px_40px_rgba(0,0,0,0.07)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={toggleArchive}
                    className="block w-full cursor-pointer px-[14px] py-[10px] text-left text-[13px] font-semibold text-ink hover:bg-hover-2"
                  >
                    {project.status === "active"
                      ? "Archive project"
                      : "Restore project"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setConfirmDelete(true);
                      setMenuOpen(false);
                    }}
                    className="block w-full cursor-pointer border-t border-divider px-[14px] py-[10px] text-left text-[13px] font-semibold text-accent-deep hover:bg-hover-2"
                  >
                    Delete project
                  </button>
                </div>
              )}
            </div>
          </div>

          {project.description && (
            <p className="mt-3 max-w-[720px] text-[14.5px] leading-[1.6] text-ink-body">
              {project.description}
            </p>
          )}

          {/* Counts row */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <CountTile label="Open tasks" value={project.counts.tasks_open} />
            <CountTile label="Completed" value={project.counts.tasks_done} />
            <CountTile label="Memories" value={project.counts.memories} />
          </div>

          {actionError && (
            <div className="mt-4 rounded-tile border border-border-card bg-surface px-4 py-2 text-[12.5px] font-semibold text-accent-deep">
              {actionError}
            </div>
          )}

          {/* Confirm delete */}
          {confirmDelete && (
            <div className="mt-4 rounded-card border border-border-card bg-surface px-5 py-4">
              <div className="text-[14px] font-semibold text-ink">
                Delete “{project.name}”?
              </div>
              <div className="mt-1 text-[12.5px] text-ink-muted-2">
                This can't be undone. Tasks under this project stay, but lose
                their project link.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busyAction === "delete"}
                  className="cursor-pointer rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "delete" ? "Deleting…" : "Delete project"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busyAction === "delete"}
                  className="cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tasks section */}
          <section className="mt-6 rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-3 flex items-baseline gap-[10px]">
              <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
                Tasks
              </h2>
              <span className="text-[12px] text-ink-faint">
                {tasks ? `${tasks.length} total` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTaskForm((v) => !v);
                  setTaskError(null);
                }}
                className="ml-auto cursor-pointer rounded-nav border border-border-button px-[11px] py-1 text-[12px] font-semibold text-ink hover:border-ink"
              >
                {showTaskForm ? "Close" : "+ Add task"}
              </button>
            </div>

            {showTaskForm && (
              <form
                onSubmit={onCreateTask}
                className="mb-3 rounded-tile border border-border-tile bg-sunken px-[14px] py-3"
              >
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  autoFocus
                  disabled={taskSubmitting}
                  className="w-full bg-transparent py-1 text-[13.5px] font-semibold text-ink placeholder:text-ink-placeholder focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-[11.5px] font-semibold text-ink-muted-2">
                    Due
                  </label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    disabled={taskSubmitting}
                    className="rounded-nav border border-border-button bg-surface px-2 py-1 text-[12px] text-ink"
                  />
                  <button
                    type="submit"
                    disabled={taskSubmitting}
                    className="ml-auto cursor-pointer rounded-nav bg-ink px-[13px] py-[6px] text-[12.5px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {taskSubmitting ? "Adding…" : "Add task"}
                  </button>
                </div>
                {taskError && (
                  <div className="mt-2 text-[12px] font-semibold text-accent-deep">
                    {taskError}
                  </div>
                )}
              </form>
            )}

            {tasks === null && (
              <div className="text-[13px] text-ink-muted-2">Loading tasks…</div>
            )}

            {tasks && tasks.length === 0 && (
              <div className="border-t border-divider py-4 text-center text-[13px] text-ink-muted-2">
                No tasks in this project yet.
              </div>
            )}

            {tasks &&
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 border-t border-divider py-[10px]"
                >
                  <button
                    type="button"
                    onClick={() => cycleStatus(task)}
                    disabled={busyAction === "status"}
                    aria-label={`Status: ${STATUS_LABEL[task.status]} (click to advance)`}
                    className={statusPillClass(task.status)}
                  >
                    {STATUS_LABEL[task.status]}
                  </button>
                  <div
                    className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink"
                    style={{
                      textDecoration:
                        task.status === "done" ? "line-through" : "none",
                      color:
                        task.status === "done" ? "#A8A8A3" : undefined,
                    }}
                  >
                    <span className="truncate">{task.title}</span>
                  </div>
                  {task.due_at && (
                    <span
                      className={
                        isOverdue(task)
                          ? "flex-none text-[11.5px] font-bold text-accent-deep"
                          : "flex-none text-[11.5px] text-ink-faint"
                      }
                    >
                      {formatDue(task.due_at)}
                    </span>
                  )}
                </div>
              ))}
          </section>
        </>
      )}
    </div>
  );
}

function statusPillClass(status: TaskStatus): string {
  const base =
    "flex-none cursor-pointer rounded-[7px] px-2 py-[3px] text-[11px] font-semibold min-w-[74px] text-center disabled:cursor-not-allowed disabled:opacity-60";
  if (status === "done") return `${base} bg-success-bg text-success`;
  if (status === "doing") return `${base} bg-tint-blue text-on-tint-blue`;
  return `${base} bg-muted-2 text-ink-muted`;
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-tile border border-border-tile bg-surface px-[14px] py-3">
      <div className="text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow uppercase">
        {label}
      </div>
      <div className="mt-[2px] text-[19px] font-bold tracking-[-0.4px] text-ink">
        {value}
      </div>
    </div>
  );
}

function isoFromDateInput(value: string): string {
  // A yyyy-mm-dd input becomes end-of-day local time so it matches "today" easily.
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [y, m, d] = parts.map((p) => Number(p));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return dt.toISOString();
}

function isOverdue(task: Task): boolean {
  if (!task.due_at || task.status === "done") return false;
  const due = new Date(task.due_at).getTime();
  if (!Number.isFinite(due)) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now.getTime();
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startDue.getTime() - startToday.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString();
}
