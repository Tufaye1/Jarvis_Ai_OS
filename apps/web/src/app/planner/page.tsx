"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTask,
  deleteTask,
  getPlannerToday,
  isApiError,
  listProjects,
  updateTask,
  type PlannerToday,
  type Project,
  type Task,
  type TaskStatus,
} from "@/lib/api";

/* ---------------------------------------------------------------- helpers */

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "done"];

/** Cycle todo -> doing -> done -> todo. */
function nextStatus(s: TaskStatus): TaskStatus {
  const i = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

/** Pill colors per status. Matches the design language (muted / warning / success). */
const STATUS_PILL: Record<TaskStatus, { bg: string; fg: string }> = {
  todo:  { bg: "#F4F4F0", fg: "#6B6B66" },
  doing: { bg: "#FBF0C4", fg: "#5A5330" },
  done:  { bg: "#E4F1E4", fg: "#3E8F53" },
};

function formatDueDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatSubtitleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** date-input value (YYYY-MM-DD) -> ISO (server picks a reasonable time). */
function dateInputToIso(value: string): string | null {
  if (!value) return null;
  // Interpret as local end-of-day so "today" filters work as expected.
  const d = new Date(`${value}T17:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/* ---------------------------------------------------------------- notices */

type Notice =
  | { kind: "loading" }
  | { kind: "error"; detail: string }
  | { kind: "ok" };

function toNotice(error: unknown): Notice {
  if (isApiError(error)) {
    if (error.isOffline)
      return {
        kind: "error",
        detail:
          "Can’t reach the API. Is it running at " +
          (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") +
          "?",
      };
    return {
      kind: "error",
      detail: `${error.status} — ${error.detail ?? "Request failed"}`,
    };
  }
  return { kind: "error", detail: "Something went wrong" };
}

/* --------------------------------------------------------------- section */

/** A generic list-of-tasks card. */
function TaskSection({
  title,
  subtitle,
  tone,
  tasks,
  projectsById,
  onCycle,
  onDelete,
  emptyLabel,
}: {
  title: string;
  subtitle?: string;
  tone?: "danger" | "warning" | "success";
  tasks: Task[];
  projectsById: Map<number, Project>;
  onCycle: (t: Task) => void;
  onDelete: (t: Task) => void;
  emptyLabel: string;
}) {
  const dot =
    tone === "danger"
      ? "#F26B21"
      : tone === "warning"
      ? "#E0A93F"
      : tone === "success"
      ? "#3E8F53"
      : null;

  return (
    <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
      <div className="flex items-baseline gap-[10px]">
        {dot && (
          <span
            aria-hidden
            className="inline-block h-[8px] w-[8px] rounded-full"
            style={{ background: dot }}
          />
        )}
        <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
          {title}
        </h2>
        <span className="text-[12px] text-ink-faint">
          {subtitle ?? `${tasks.length}`}
        </span>
      </div>

      {tasks.length === 0 ? (
        <div className="mt-3 border-t border-divider pt-[14px] text-[13px] text-ink-faint">
          {emptyLabel}
        </div>
      ) : (
        <ul>
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              projectsById={projectsById}
              tone={tone}
              onCycle={onCycle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({
  task,
  projectsById,
  tone,
  onCycle,
  onDelete,
}: {
  task: Task;
  projectsById: Map<number, Project>;
  tone?: "danger" | "warning" | "success";
  onCycle: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const project = task.project_id ? projectsById.get(task.project_id) : null;
  const pill = STATUS_PILL[task.status];
  const dueColor =
    tone === "danger" ? "#C0532A" : tone === "warning" ? "#5A5330" : "#9A9A96";

  return (
    <li className="group flex items-center gap-3 border-t border-divider py-[10px]">
      <button
        type="button"
        onClick={() => onCycle(task)}
        className="flex-none rounded-[7px] px-[8px] py-[3px] text-[11px] font-bold transition-colors hover:brightness-95"
        style={{ background: pill.bg, color: pill.fg }}
        title="Click to cycle status: to do → doing → done"
      >
        {STATUS_LABEL[task.status]}
      </button>

      <span
        className={`text-[13.5px] font-semibold text-ink ${
          task.status === "done" ? "line-through text-ink-eyebrow" : ""
        }`}
      >
        {task.title}
      </span>

      {project && (
        <span className="rounded-[6px] bg-muted px-[7px] py-[3px] text-[11px] font-semibold text-ink-muted">
          {project.name}
        </span>
      )}

      <span className="ml-auto flex items-center gap-3">
        {task.due_at && (
          <span
            className="text-[11.5px] font-bold"
            style={{ color: dueColor }}
          >
            {formatDueDate(task.due_at)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Delete ${task.title}`}
          className="rounded-[6px] px-[6px] py-[2px] text-[11px] text-ink-faint opacity-0 transition-opacity hover:bg-muted hover:text-ink group-hover:opacity-100"
        >
          Delete
        </button>
      </span>
    </li>
  );
}

/* ------------------------------------------------------- add-task form -- */

function AddTaskForm({
  projects,
  onCreate,
}: {
  projects: Project[];
  onCreate: (t: {
    title: string;
    project_id: number | null;
    due_at: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        project_id: projectId === "" ? null : Number(projectId),
        due_at: dateInputToIso(dueDate),
      });
      setTitle("");
      setDueDate("");
      // keep project selected — usually you're adding several to the same project
    } catch (err) {
      const n = toNotice(err);
      setError(n.kind === "error" ? n.detail : "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mb-[14px] flex items-center gap-2 rounded-card border border-border-card bg-surface px-4 py-[10px]"
    >
      <span aria-hidden className="text-[16px] font-bold text-ink-faint">
        +
      </span>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="flex-1 bg-transparent text-[13.5px] font-medium text-ink outline-none placeholder:text-ink-faint"
        aria-label="Task title"
      />
      <select
        value={projectId}
        onChange={(e) =>
          setProjectId(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="rounded-[8px] border border-border-chip bg-white px-2 py-[5px] text-[12px] font-semibold text-ink-secondary"
        aria-label="Project"
      >
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="rounded-[8px] border border-border-chip bg-white px-2 py-[5px] text-[12px] font-semibold text-ink-secondary"
        aria-label="Due date"
      />
      <button
        type="submit"
        disabled={!title.trim() || saving}
        className="rounded-nav bg-ink px-[13px] py-[8px] text-[12.5px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-ink-eyebrow"
      >
        {saving ? "Adding…" : "Add"}
      </button>
      {error && (
        <span className="text-[11.5px] font-semibold text-accent">{error}</span>
      )}
    </form>
  );
}

/* ------------------------------------------------------- priorities card */

function PrioritiesCard({
  priorities,
  onCycle,
}: {
  priorities: Task[];
  onCycle: (t: Task) => void;
}) {
  return (
    <section
      className="mb-[14px] rounded-[20px] px-6 py-[22px]"
      style={{ background: "#101010" }}
    >
      <div
        className="mb-[14px] text-[10.5px] font-bold tracking-[0.7px]"
        style={{ color: "#86867E" }}
      >
        TOP 3 PRIORITIES
      </div>

      {priorities.length === 0 ? (
        <div
          className="rounded-[12px] px-4 py-[14px] text-[13.5px] font-semibold"
          style={{ background: "#1a1a1a", color: "#A9A9A2" }}
        >
          Nothing lined up. Add a task to plan the day.
        </div>
      ) : (
        <ul>
          {priorities.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-[14px]"
              style={{
                paddingTop: i === 0 ? 0 : 12,
                marginTop: i === 0 ? 0 : 12,
                borderTop: i === 0 ? "none" : "1px solid #262622",
              }}
            >
              <span
                className="w-[16px] flex-none text-[12px] font-bold"
                style={{ color: "#F26B21" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => onCycle(t)}
                className={`flex-1 text-left text-[17px] font-semibold tracking-[-0.3px] ${
                  t.status === "done" ? "line-through opacity-60" : ""
                }`}
                style={{ color: "#FFFFFF" }}
                title="Click to cycle status"
              >
                {t.title}
              </button>
              <span
                className="flex-none text-[11.5px] font-semibold"
                style={{ color: "#A9A9A2" }}
              >
                {t.status === "doing"
                  ? "In progress"
                  : t.due_at
                  ? formatDueDate(t.due_at)
                  : STATUS_LABEL[t.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- page --- */

export default function PlannerPage() {
  const [data, setData] = useState<PlannerToday | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notice, setNotice] = useState<Notice>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [planner, projectList] = await Promise.all([
        getPlannerToday(),
        listProjects({ status: "active" }).catch(() => [] as Project[]),
      ]);
      setData(planner);
      setProjects(projectList);
      setNotice({ kind: "ok" });
    } catch (err) {
      setNotice(toNotice(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const planner = await getPlannerToday();
      setData(planner);
    } catch (err) {
      setNotice(toNotice(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const projectsById = useMemo(() => {
    const m = new Map<number, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const handleCreate = useCallback(
    async (input: {
      title: string;
      project_id: number | null;
      due_at: string | null;
    }) => {
      await createTask(input);
      await refresh();
    },
    [refresh],
  );

  const handleCycle = useCallback(
    async (task: Task) => {
      const target = nextStatus(task.status);
      // optimistic
      setData((prev) => (prev ? patchTaskInPlanner(prev, task.id, target) : prev));
      try {
        await updateTask(task.id, { status: target });
        await refresh();
      } catch (err) {
        // revert on failure
        setData((prev) =>
          prev ? patchTaskInPlanner(prev, task.id, task.status) : prev,
        );
        setNotice(toNotice(err));
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (task: Task) => {
      try {
        await deleteTask(task.id);
        await refresh();
      } catch (err) {
        setNotice(toNotice(err));
      }
    },
    [refresh],
  );

  if (notice.kind === "loading") {
    return (
      <div className="max-w-[1180px] px-11 pt-8 pb-7">
        <div className="text-[30px] font-bold tracking-[-1px] text-ink">
          Today
        </div>
        <div className="mt-1 text-[13.5px] text-ink-muted-2">Loading…</div>
      </div>
    );
  }

  if (notice.kind === "error" || !data) {
    const detail = notice.kind === "error" ? notice.detail : "No data";
    return (
      <div className="max-w-[1180px] px-11 pt-8 pb-7">
        <div className="text-[30px] font-bold tracking-[-1px] text-ink">
          Today
        </div>
        <div className="mt-1 text-[13.5px] text-ink-muted-2">
          Could not load the planner.
        </div>
        <div className="mt-4 rounded-card border border-border-card bg-surface px-5 py-4 text-[13px] text-ink-body">
          {detail}
          <button
            type="button"
            onClick={() => {
              setNotice({ kind: "loading" });
              void load();
            }}
            className="ml-3 rounded-nav border border-border-button bg-white px-3 py-1 text-[12.5px] font-semibold text-ink hover:border-ink"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalOpen =
    data.priorities.length +
    data.overdue.length +
    data.due_today.length +
    data.in_progress.length;

  const subtitle =
    totalOpen === 0
      ? "Nothing on the board yet. Add a task to get moving."
      : `${totalOpen} task${totalOpen === 1 ? "" : "s"} on today’s board · ${
          data.priorities.length
        } prioritised`;

  return (
    <div className="max-w-[1180px] px-11 pt-8 pb-7">
      {/* Header */}
      <div className="text-[30px] font-bold tracking-[-1px] text-ink">
        Today
      </div>
      <div className="mt-1 mb-5 flex items-center gap-3">
        <span className="text-[13.5px] text-ink-muted-2">{subtitle}</span>
        <span className="text-[12px] text-ink-faint">
          · {formatSubtitleDate(data.date)}
        </span>
        {refreshing && (
          <span className="text-[11.5px] text-ink-faint">Refreshing…</span>
        )}
      </div>

      {/* Add task */}
      <AddTaskForm projects={projects} onCreate={handleCreate} />

      {/* Top 3 priorities */}
      <PrioritiesCard priorities={data.priorities} onCycle={handleCycle} />

      {/* Sections */}
      <div className="flex flex-col gap-3">
        <TaskSection
          title="Overdue"
          tone="danger"
          tasks={data.overdue}
          projectsById={projectsById}
          onCycle={handleCycle}
          onDelete={handleDelete}
          emptyLabel="Nothing overdue. Nice."
        />
        <TaskSection
          title="Due today"
          tone="warning"
          tasks={data.due_today}
          projectsById={projectsById}
          onCycle={handleCycle}
          onDelete={handleDelete}
          emptyLabel="No deadlines land today."
        />
        <TaskSection
          title="In progress"
          tasks={data.in_progress}
          projectsById={projectsById}
          onCycle={handleCycle}
          onDelete={handleDelete}
          emptyLabel="Nothing in flight. Pick a task and start."
        />
        <TaskSection
          title="Completed today"
          tone="success"
          tasks={data.completed_today}
          projectsById={projectsById}
          onCycle={handleCycle}
          onDelete={handleDelete}
          emptyLabel="No wins logged yet. Close one out."
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- patcher --- */

/** Optimistically move a task to a new status inside the planner buckets. */
function patchTaskInPlanner(
  planner: PlannerToday,
  taskId: number,
  status: TaskStatus,
): PlannerToday {
  const bump = (list: Task[]): Task[] =>
    list.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status,
            completed_at:
              status === "done"
                ? t.completed_at ?? new Date().toISOString()
                : null,
          }
        : t,
    );
  return {
    ...planner,
    priorities: bump(planner.priorities),
    overdue: bump(planner.overdue),
    due_today: bump(planner.due_today),
    in_progress: bump(planner.in_progress),
    completed_today: bump(planner.completed_today),
  };
}
