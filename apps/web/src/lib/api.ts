/**
 * Typed client for the Jarvis HTTP API (chat + memory volumes).
 *
 * Every call goes through `request`, which turns any non-2xx response into an
 * `ApiError` carrying the HTTP status, so the UI can tell "not configured yet"
 * (503) apart from "gone" (404) or "the API is not running at all" (status 0).
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ---------------------------------------------------------------- types --- */

/** A note that grounded an assistant reply. */
export interface Source {
  note_id: number;
  title: string | null;
  vault_path: string | null;
  score: number | null;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: number;
  role: MessageRole;
  content: string;
  /** Null for user messages and for ungrounded replies. */
  sources: Source[] | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  /** Null until the first user message derives one. */
  title: string | null;
  created_at: string;
  updated_at: string;
}

/** One full round trip returned by POST /chat/conversations/{cid}/messages. */
export interface ChatTurn {
  user_message: Message;
  assistant_message: Message;
}

export interface Memory {
  id: number;
  scope: string;
  project: string | null;
  content: string;
  source_conversation_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryExtraction {
  extracted: Memory[];
  count: number;
}

/* ---------------------------------------------------------------- error --- */

/**
 * Any failed API call. `status` is the HTTP status, or 0 when the request
 * never reached the server (API down, CORS, offline).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string | null;
  readonly url: string;

  constructor(status: number, url: string, detail: string | null) {
    super(detail ?? `Request to ${url} failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.url = url;
  }

  /** The API is reachable but has no Anthropic key wired up. */
  get isUnconfigured(): boolean {
    return this.status === 503;
  }

  /** The request never made it to the server. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/* -------------------------------------------------------------- request --- */

async function readDetail(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      const body: unknown = JSON.parse(text);
      if (body && typeof body === "object" && "detail" in body) {
        const detail = (body as { detail: unknown }).detail;
        if (typeof detail === "string") return detail;
        return JSON.stringify(detail);
      }
    } catch {
      /* not JSON — fall through to the raw body */
    }
    return text.slice(0, 300);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ApiError(
      0,
      url,
      cause instanceof Error ? cause.message : "Network request failed",
    );
  }

  if (!response.ok) {
    throw new ApiError(response.status, url, await readDetail(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/* ----------------------------------------------------------------- chat --- */

/** All conversations, newest first. */
export function listConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/chat/conversations", { cache: "no-store" });
}

export function createConversation(): Promise<Conversation> {
  return request<Conversation>("/chat/conversations", { method: "POST" });
}

/** Full transcript of one conversation, oldest first. */
export function listMessages(conversationId: number): Promise<Message[]> {
  return request<Message[]>(`/chat/conversations/${conversationId}/messages`, {
    cache: "no-store",
  });
}

/** Send a user turn and get the grounded assistant reply back. Throws 503 with no API key. */
export function sendMessage(
  conversationId: number,
  content: string,
): Promise<ChatTurn> {
  return request<ChatTurn>(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function deleteConversation(conversationId: number): Promise<void> {
  return request<void>(`/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

/* --------------------------------------------------------------- memory --- */

export function listMemories(params?: {
  scope?: string;
  project?: string;
}): Promise<Memory[]> {
  const query = new URLSearchParams();
  if (params?.scope) query.set("scope", params.scope);
  if (params?.project) query.set("project", params.project);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<Memory[]>(`/memory${suffix}`, { cache: "no-store" });
}

export function createMemory(input: {
  scope: string;
  project?: string | null;
  content: string;
}): Promise<Memory> {
  return request<Memory>("/memory", {
    method: "POST",
    body: JSON.stringify({
      scope: input.scope,
      project: input.project ?? null,
      content: input.content,
    }),
  });
}

export function deleteMemory(memoryId: number): Promise<void> {
  return request<void>(`/memory/${memoryId}`, { method: "DELETE" });
}

export function extractMemories(
  conversationId: number,
): Promise<MemoryExtraction> {
  return request<MemoryExtraction>("/memory/extract", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

/* ------------------------------------------------------------- projects --- */

export type ProjectStatus = "active" | "archived";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectCounts {
  tasks_open: number;
  tasks_done: number;
  memories: number;
}

export interface ProjectDetail extends Project {
  counts: ProjectCounts;
}

export function listProjects(params?: {
  status?: ProjectStatus;
}): Promise<Project[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<Project[]>(`/projects${suffix}`, { cache: "no-store" });
}

export function getProject(id: number): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${id}`, { cache: "no-store" });
}

export function createProject(input: {
  name: string;
  description?: string | null;
}): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
    }),
  });
}

export function updateProject(
  id: number,
  patch: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
  },
): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteProject(id: number): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

/* ---------------------------------------------------------------- tasks --- */

export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  project_id: number | null;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function listTasks(params?: {
  project_id?: number;
  status?: TaskStatus;
  limit?: number;
}): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params?.project_id !== undefined)
    query.set("project_id", String(params.project_id));
  if (params?.status) query.set("status", params.status);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<Task[]>(`/tasks${suffix}`, { cache: "no-store" });
}

export function getTask(id: number): Promise<Task> {
  return request<Task>(`/tasks/${id}`, { cache: "no-store" });
}

export function createTask(input: {
  title: string;
  description?: string | null;
  project_id?: number | null;
  due_at?: string | null;
}): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      project_id: input.project_id ?? null,
      due_at: input.due_at ?? null,
    }),
  });
}

export function updateTask(
  id: number,
  patch: {
    title?: string;
    description?: string | null;
    project_id?: number | null;
    status?: TaskStatus;
    due_at?: string | null;
  },
): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE" });
}

/* -------------------------------------------------------------- planner --- */

export interface PlannerToday {
  /** ISO date, e.g. "2026-08-07". */
  date: string;
  priorities: Task[];
  overdue: Task[];
  due_today: Task[];
  in_progress: Task[];
  completed_today: Task[];
}

export function getPlannerToday(): Promise<PlannerToday> {
  return request<PlannerToday>("/planner/today", { cache: "no-store" });
}

/* -------------------------------------------------------------- content --- */

export type ContentKind =
  | "linkedin"
  | "blog"
  | "email"
  | "proposal"
  | "report"
  | "deck_outline"
  | "tweet";

export type ContentStatus = "draft" | "final" | "archived";

export type ContentLength = "short" | "medium" | "long";

export interface ContentDraft {
  id: number;
  kind: ContentKind;
  title: string | null;
  /** Null when the LLM call failed but the row was persisted anyway. */
  body: string | null;
  prompt: string;
  tone: string | null;
  length: ContentLength | null;
  status: ContentStatus;
  project_id: number | null;
  source_conversation_id: number | null;
  sources: Source[] | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentGenerateRequest {
  kind: ContentKind;
  prompt: string;
  project_id?: number | null;
  tone?: string | null;
  length?: ContentLength | null;
  source_conversation_id?: number | null;
  notes_query?: string | null;
}

export interface ContentUpdate {
  title?: string | null;
  body?: string;
  tone?: string | null;
  length?: ContentLength | null;
  status?: ContentStatus;
}

export function generateContent(
  payload: ContentGenerateRequest,
): Promise<ContentDraft> {
  return request<ContentDraft>("/content/generate", {
    method: "POST",
    body: JSON.stringify({
      kind: payload.kind,
      prompt: payload.prompt,
      project_id: payload.project_id ?? null,
      tone: payload.tone ?? null,
      length: payload.length ?? null,
      source_conversation_id: payload.source_conversation_id ?? null,
      notes_query: payload.notes_query ?? null,
    }),
  });
}

export function listContent(params?: {
  project_id?: number;
  kind?: ContentKind;
  status?: ContentStatus;
  limit?: number;
}): Promise<ContentDraft[]> {
  const query = new URLSearchParams();
  if (params?.project_id !== undefined)
    query.set("project_id", String(params.project_id));
  if (params?.kind) query.set("kind", params.kind);
  if (params?.status) query.set("status", params.status);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ContentDraft[]>(`/content${suffix}`, { cache: "no-store" });
}

export function getContent(id: number): Promise<ContentDraft> {
  return request<ContentDraft>(`/content/${id}`, { cache: "no-store" });
}

export function updateContent(
  id: number,
  patch: ContentUpdate,
): Promise<ContentDraft> {
  return request<ContentDraft>(`/content/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteContent(id: number): Promise<void> {
  return request<void>(`/content/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------- research --- */

export type ResearchStatus = "pending" | "ready" | "failed";

export interface ResearchQuery {
  id: number;
  query: string;
  summary: string | null;
  status: ResearchStatus;
  sources: Source[] | null;
  project_id: number | null;
  saved_as_note_id: number | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchQueryRequest {
  query: string;
  project_id?: number | null;
  save_to_vault?: boolean;
}

export function listResearch(params?: {
  project_id?: number;
  status?: ResearchStatus;
  limit?: number;
}): Promise<ResearchQuery[]> {
  const query = new URLSearchParams();
  if (params?.project_id !== undefined)
    query.set("project_id", String(params.project_id));
  if (params?.status) query.set("status", params.status);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<ResearchQuery[]>(`/research${suffix}`, { cache: "no-store" });
}

export function getResearch(id: number): Promise<ResearchQuery> {
  return request<ResearchQuery>(`/research/${id}`, { cache: "no-store" });
}

export function createResearch(
  payload: ResearchQueryRequest,
): Promise<ResearchQuery> {
  return request<ResearchQuery>("/research/query", {
    method: "POST",
    body: JSON.stringify({
      query: payload.query,
      project_id: payload.project_id ?? null,
      save_to_vault: payload.save_to_vault ?? false,
    }),
  });
}

export function deleteResearch(id: number): Promise<void> {
  return request<void>(`/research/${id}`, { method: "DELETE" });
}

export function saveResearchToVault(id: number): Promise<ResearchQuery> {
  return request<ResearchQuery>(`/research/${id}/save-to-vault`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
