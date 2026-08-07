"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  isApiError,
  listProjects,
  type Project,
  type ProjectStatus,
} from "@/lib/api";

type FilterValue = ProjectStatus;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

function friendlyError(err: unknown): string {
  if (isApiError(err)) {
    if (err.isOffline) return "Can't reach the API. Is it running?";
    if (err.isUnconfigured) return "API is up but not configured yet.";
    return err.detail ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export default function ProjectsPage() {
  const [filter, setFilter] = useState<FilterValue>("active");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async (status: FilterValue) => {
    setProjects(null);
    setLoadError(null);
    try {
      const data = await listProjects({ status });
      setProjects(data);
    } catch (err) {
      setLoadError(friendlyError(err));
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setSubmitError("Give the project a name.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const desc = description.trim();
      await createProject({
        name: trimmed,
        description: desc.length > 0 ? desc : null,
      });
      setName("");
      setDescription("");
      setShowForm(false);
      if (filter !== "active") setFilter("active");
      else await load("active");
    } catch (err) {
      setSubmitError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1180px] px-11 pt-10 pb-7">
      {/* Header */}
      <div className="mb-5 flex items-end gap-[14px]">
        <div>
          <h1 className="mb-1 text-[30px] font-bold tracking-[-1px] text-ink">
            Projects
          </h1>
          <p className="text-[13.5px] text-ink-muted-2">
            The workspaces Jervis organises around
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setSubmitError(null);
          }}
          className="ml-auto flex cursor-pointer items-center gap-2 rounded-field bg-ink px-[15px] py-[10px] text-[13px] font-semibold text-white hover:bg-ink-hover"
        >
          <span className="text-[15px] leading-none">+</span>
          <span>{showForm ? "Close" : "New project"}</span>
        </button>
      </div>

      {/* Filter chips */}
      <div className="mb-[18px] flex flex-wrap gap-[7px]">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={
                active
                  ? "cursor-pointer rounded-chip bg-ink px-[11px] py-[6px] text-[12px] font-semibold text-white"
                  : "cursor-pointer rounded-chip border border-border-chip px-[11px] py-[6px] text-[12px] font-semibold text-ink-secondary hover:border-ink"
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Inline new-project form */}
      {showForm && (
        <form
          onSubmit={onSubmit}
          className="mb-[18px] rounded-card border border-border-card bg-surface px-5 py-[18px]"
        >
          <div className="mb-[6px] text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
            NEW PROJECT
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            disabled={submitting}
            className="w-full border-b border-divider bg-transparent py-2 text-[15px] font-semibold text-ink placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            disabled={submitting}
            className="mt-2 w-full resize-none bg-transparent py-2 text-[13.5px] text-ink placeholder:text-ink-placeholder focus:outline-none"
          />
          {submitError && (
            <div className="mt-2 text-[12px] font-semibold text-accent-deep">
              {submitError}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating…" : "Create project"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSubmitError(null);
                setName("");
                setDescription("");
              }}
              disabled={submitting}
              className="cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* States */}
      {loadError && (
        <div className="mb-[18px] rounded-card border border-border-card bg-surface px-5 py-4 text-[13px] font-semibold text-accent-deep">
          {loadError}
        </div>
      )}

      {projects === null && !loadError && (
        <div className="text-[13.5px] text-ink-muted-2">Loading projects…</div>
      )}

      {projects && projects.length === 0 && !loadError && (
        <div className="rounded-card border border-border-card bg-surface px-5 py-8 text-center">
          <div className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
            {filter === "active"
              ? "No active projects yet"
              : "Nothing archived"}
          </div>
          <div className="text-[13px] text-ink-muted-2">
            {filter === "active"
              ? "Create one to give Jervis a workspace to organise around."
              : "Projects you archive will land here."}
          </div>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex cursor-pointer flex-col rounded-grid-card border border-border-card bg-surface p-[14px] hover:border-border-hover"
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[13.5px] font-bold tracking-[-0.1px] text-ink">
          {project.name}
        </div>
        {project.status === "active" ? (
          <span className="flex-none rounded-[7px] bg-success-bg px-2 py-[3px] text-[11px] font-semibold text-success">
            Active
          </span>
        ) : (
          <span className="flex-none rounded-[7px] bg-muted-2 px-2 py-[3px] text-[11px] font-semibold text-ink-muted">
            Archived
          </span>
        )}
      </div>
      {project.description && (
        <div className="mt-[6px] line-clamp-3 text-[11.5px] leading-[1.45] text-ink-muted-2">
          {project.description}
        </div>
      )}
      <div className="mt-[10px] border-t border-divider-2 pt-[10px] text-[11px] text-ink-faint">
        Updated {formatRelative(project.updated_at)}
      </div>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
