const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function getHealth() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return { status: "error", detail: `HTTP ${res.status}` };
    return res.json();
  } catch {
    return { status: "unreachable", detail: `could not reach ${API_URL}` };
  }
}

export default async function Home() {
  const health = await getHealth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Jarvis AI OS
      </h1>
      <pre className="rounded bg-black/[.06] px-4 py-3 font-mono text-sm dark:bg-white/[.08] dark:text-zinc-50">
        {JSON.stringify(health, null, 2)}
      </pre>
    </div>
  );
}
