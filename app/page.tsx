"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StatusResponse = {
  status: "online" | "offline" | "degraded";
  containerName: string;
  composeService: string;
  containerState: string;
  running: boolean;
  uptime: string;
  composePath: string;
  composeFileExists: boolean;
  soulPath: string;
  soulFileExists: boolean;
  checkedAt: string;
  host: string;
  errors: string[];
  authConfigured: boolean;
};

type LogsResponse = {
  logs: string;
  tail: number;
  checkedAt?: string;
  error?: string;
};

type SoulResponse = {
  content: string;
  exists: boolean;
  path: string;
  message?: string;
};

const statusTone = {
  online: {
    label: "Online",
    chip: "bg-emerald-400/12 text-emerald-300 border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  offline: {
    label: "Offline",
    chip: "bg-rose-400/12 text-rose-300 border-rose-400/20",
    dot: "bg-rose-400",
  },
  degraded: {
    label: "Degraded",
    chip: "bg-amber-400/12 text-amber-200 border-amber-400/20",
    dot: "bg-amber-400",
  },
} as const;

const TOKEN_STORAGE_KEY = "al-panel-token";

function timeLabel(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function MetricCard({
  eyebrow,
  title,
  value,
  detail,
}: {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="glass-card metric-glow rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{eyebrow}</p>
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      <div className="mt-6 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-2 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

export default function Home() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogsResponse | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [soul, setSoul] = useState<SoulResponse | null>(null);
  const [soulDraft, setSoulDraft] = useState("");
  const [soulDirty, setSoulDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSoul, setSavingSoul] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [panelToken, setPanelToken] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  const requestJson = useCallback(
    async <T,>(url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (panelToken) {
        headers.set("x-panel-token", panelToken);
      }

      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers,
      });

      const data = (await response.json()) as T & { message?: string; authRequired?: boolean };
      return { response, data };
    },
    [panelToken]
  );

  const loadDashboard = useCallback(
    async (isBackground = false) => {
      if (isBackground) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [statusResult, logsResult, soulResult] = await Promise.all([
          requestJson<StatusResponse>("/api/status"),
          requestJson<LogsResponse>("/api/logs?tail=160"),
          requestJson<SoulResponse>("/api/soul"),
        ]);

        if (
          statusResult.response.status === 401 ||
          logsResult.response.status === 401 ||
          soulResult.response.status === 401
        ) {
          setAuthRequired(true);
          setStatusError("Dashboard token required.");
          setLogsError("Dashboard token required.");
          return;
        }

        setAuthRequired(false);

        if (statusResult.response.ok) {
          setStatus(statusResult.data);
          setStatusError(null);
        } else {
          setStatus(null);
          setStatusError(statusResult.data.message || "Could not load status.");
        }

        if (logsResult.response.ok) {
          setLogs(logsResult.data);
          setLogsError(null);
        } else {
          setLogs(null);
          setLogsError(logsResult.data.message || logsResult.data.error || "Could not load logs.");
        }

        if (soulResult.response.ok) {
          setSoul(soulResult.data);
          if (!soulDirty) {
            setSoulDraft(soulResult.data.content || "");
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        setStatusError(message);
        setLogsError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestJson, soulDirty]
  );

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadDashboard();
    }, 0);
    const interval = window.setInterval(() => loadDashboard(true), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [loadDashboard]);

  const tone = status ? statusTone[status.status] : statusTone.degraded;
  const errorList = useMemo(() => status?.errors ?? [], [status]);

  function savePanelToken() {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, panelToken);
    showToast("Token saved locally in browser.");
    loadDashboard();
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      const { response, data } = await requestJson<{ restarted?: boolean; message?: string }>(
        "/api/restart",
        { method: "POST" }
      );
      if (!response.ok) throw new Error(data.message || "Restart failed");
      showToast(data.message || "Restart command sent.");
      window.setTimeout(() => loadDashboard(true), 2000);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Restart failed");
    } finally {
      setRestarting(false);
    }
  }

  async function handleSaveSoul() {
    setSavingSoul(true);
    try {
      const { response, data } = await requestJson<{ saved?: boolean; message?: string }>("/api/soul", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: soulDraft }),
      });
      if (!response.ok) throw new Error(data.message || "Save failed");
      setSoulDirty(false);
      showToast("Soul saved.");
      await loadDashboard(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingSoul(false);
    }
  }

  return (
    <main className="panel-shell min-h-screen px-4 py-6 text-[var(--foreground)] sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="glass-card rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] ${tone.chip}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                {tone.label}
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                AL Dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                Gotowy panel do kontroli Hieniek / AL. Masz tu status kontenera, szybki restart,
                live logi i edycję pliku soul bez wchodzenia na serwer.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => loadDashboard(true)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                type="button"
              >
                {refreshing ? "Refreshing..." : "Refresh now"}
              </button>
              <button
                onClick={handleRestart}
                disabled={restarting || authRequired}
                className="rounded-2xl bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
              >
                {restarting ? "Restarting..." : "Restart service"}
              </button>
            </div>
          </div>
        </section>

        {toast && (
          <div className="fixed right-6 top-6 z-50 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
            {toast}
          </div>
        )}

        {authRequired && (
          <section className="glass-card rounded-[2rem] p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Security</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Dashboard token required</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              This panel is protected. Wklej token z `PANEL_AUTH_TOKEN`, zapisz go lokalnie w przeglądarce i odśwież dane.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={panelToken}
                onChange={(event) => setPanelToken(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                placeholder="Paste dashboard token"
                type="password"
              />
              <button
                onClick={savePanelToken}
                className="rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                type="button"
              >
                Save token
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass-card h-36 animate-pulse rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-4">
              <MetricCard
                eyebrow="Container"
                title="Runtime state"
                value={status?.containerState || "unknown"}
                detail={`Target: ${status?.containerName || "hermes-agent"}`}
              />
              <MetricCard
                eyebrow="Uptime"
                title="Container uptime"
                value={status?.uptime || "—"}
                detail={status?.running ? "Container is serving." : "Container is not running."}
              />
              <MetricCard
                eyebrow="Host"
                title="Server hostname"
                value={status?.host || "unknown"}
                detail={`Checked: ${timeLabel(status?.checkedAt)}`}
              />
              <MetricCard
                eyebrow="Files"
                title="Compose + soul"
                value={`${status?.composeFileExists ? "Compose ok" : "No compose"}`}
                detail={status?.soulFileExists ? "Soul file ready" : "Soul file will be created on first save"}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="glass-card rounded-[2rem] p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Operations</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Live logs</h2>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">
                    Tail {logs?.tail ?? 160}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[var(--muted)]">
                  Ostatnie logi z kontenera. Dobre do szybkiego sprawdzania czy agent żyje i co robi.
                </p>

                <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
                  {logsError ? (
                    <div className="text-sm text-rose-300">{logsError}</div>
                  ) : (
                    <pre className="log-scrollbar max-h-[460px] overflow-auto whitespace-pre-wrap text-xs leading-6 text-slate-200">
                      {logs?.logs || "No logs yet."}
                    </pre>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="glass-card rounded-[2rem] p-6 sm:p-7">
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Health</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">Quick diagnostics</h2>

                  <div className="mt-6 space-y-4 text-sm text-[var(--muted)]">
                    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                      <p className="font-medium text-white">Compose path</p>
                      <p className="mt-1 break-all">{status?.composePath || "—"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                      <p className="font-medium text-white">Compose service</p>
                      <p className="mt-1 break-all">{status?.composeService || "hermes"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                      <p className="font-medium text-white">Soul path</p>
                      <p className="mt-1 break-all">{status?.soulPath || soul?.path || "—"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                      <p className="font-medium text-white">State notes</p>
                      {statusError ? (
                        <p className="mt-1 text-rose-300">{statusError}</p>
                      ) : errorList.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-amber-200">
                          {errorList.map((error) => (
                            <li key={error}>• {error}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-emerald-300">No major issues detected.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-[2rem] p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Soul</p>
                      <h2 className="mt-3 text-2xl font-semibold text-white">Personality editor</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--muted)]">
                      {soul?.exists ? "Existing file" : "Will create on save"}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Tu możesz wkleić lub poprawić styl, instrukcje i charakter AL bez dotykania terminala.
                  </p>

                  <textarea
                    value={soulDraft}
                    onChange={(event) => {
                      setSoulDraft(event.target.value);
                      setSoulDirty(true);
                    }}
                    className="mt-5 min-h-[260px] w-full rounded-[1.5rem] border border-white/10 bg-black/35 p-4 font-mono text-sm text-slate-100 outline-none transition focus:border-white/20 focus:bg-black/45"
                    placeholder="Write AL soul / personality instructions here..."
                  />

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-xs text-[var(--muted)]">
                      {soulDirty ? "Unsaved changes." : soul?.message || "Ready to edit."}
                    </p>
                    <button
                      onClick={handleSaveSoul}
                      disabled={savingSoul || authRequired}
                      className="rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                    >
                      {savingSoul ? "Saving..." : "Save soul"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
