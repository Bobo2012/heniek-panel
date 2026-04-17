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
  auditLogPath: string;
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

type AuditEntry = {
  id: string;
  timestamp: string;
  action: string;
  status: "success" | "failure" | "warning" | "info";
  detail: string;
  ip: string;
  userAgent: string;
};

type AuditResponse = {
  entries: AuditEntry[];
  path?: string;
  message?: string;
};

type ConfirmAction = "restart" | "save" | null;

const statusTone = {
  online: {
    label: "Online",
    chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    dot: "bg-emerald-400",
  },
  offline: {
    label: "Offline",
    chip: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    dot: "bg-rose-400",
  },
  degraded: {
    label: "Attention",
    chip: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    dot: "bg-amber-300",
  },
} as const;

const actionTone = {
  success: "border-emerald-400/20 bg-emerald-400/8 text-emerald-100",
  failure: "border-rose-400/20 bg-rose-400/8 text-rose-100",
  warning: "border-amber-400/20 bg-amber-400/8 text-amber-100",
  info: "border-white/10 bg-white/5 text-white/80",
} as const;

const TOKEN_STORAGE_KEY = "al-dashboard-token";
const tailOptions = [50, 120, 200] as const;

function timeLabel(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function relativeTime(iso?: string) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
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
    <div className="premium-card rounded-[1.6rem] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">{eyebrow}</p>
      <h3 className="mt-3 text-sm font-medium text-white/92">{title}</h3>
      <div className="mt-5 text-[1.9rem] font-semibold tracking-[-0.04em] text-white">{value}</div>
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
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSoul, setSavingSoul] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedTail, setSelectedTail] = useState<number>(120);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmInput, setConfirmInput] = useState("");
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
        const [statusResult, logsResult, soulResult, auditResult] = await Promise.all([
          requestJson<StatusResponse>("/api/status"),
          requestJson<LogsResponse>(`/api/logs?tail=${selectedTail}`),
          requestJson<SoulResponse>("/api/soul"),
          requestJson<AuditResponse>("/api/audit?limit=12"),
        ]);

        if (
          statusResult.response.status === 401 ||
          logsResult.response.status === 401 ||
          soulResult.response.status === 401 ||
          auditResult.response.status === 401
        ) {
          setAuthRequired(true);
          setStatusError("Dashboard token required.");
          setLogsError("Dashboard token required.");
          setAuditError("Dashboard token required.");
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

        if (auditResult.response.ok) {
          setAudit(auditResult.data.entries || []);
          setAuditError(null);
        } else {
          setAudit([]);
          setAuditError(auditResult.data.message || "Could not load activity.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        setStatusError(message);
        setLogsError(message);
        setAuditError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestJson, selectedTail, soulDirty]
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
  const confirmKeyword = confirmAction === "restart" ? "RESTART" : confirmAction === "save" ? "SAVE" : "";
  const confirmReady = confirmKeyword.length > 0 && confirmInput.trim().toUpperCase() === confirmKeyword;
  const authStateLabel = authRequired ? "Locked" : status?.authConfigured ? "Protected" : "Open";

  function savePanelToken() {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, panelToken);
    showToast("Token saved locally in browser.");
    loadDashboard();
  }

  function clearPanelToken() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setPanelToken("");
    setAuthRequired(Boolean(status?.authConfigured));
    showToast("Local token removed.");
  }

  function openConfirm(action: Exclude<ConfirmAction, null>) {
    setConfirmAction(action);
    setConfirmInput("");
  }

  function closeConfirm() {
    setConfirmAction(null);
    setConfirmInput("");
  }

  async function performRestart() {
    setRestarting(true);
    try {
      const { response, data } = await requestJson<{ restarted?: boolean; message?: string }>("/api/restart", {
        method: "POST",
      });
      if (!response.ok) throw new Error(data.message || "Restart failed");
      showToast(data.message || "Restart command sent.");
      closeConfirm();
      window.setTimeout(() => loadDashboard(true), 1800);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Restart failed");
    } finally {
      setRestarting(false);
    }
  }

  async function performSaveSoul() {
    setSavingSoul(true);
    try {
      const { response, data } = await requestJson<{ saved?: boolean; message?: string }>("/api/soul", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: soulDraft }),
      });
      if (!response.ok) throw new Error(data.message || "Save failed");
      setSoulDirty(false);
      closeConfirm();
      showToast("Soul saved.");
      await loadDashboard(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingSoul(false);
    }
  }

  async function confirmPrimaryAction() {
    if (confirmAction === "restart") {
      await performRestart();
      return;
    }
    if (confirmAction === "save") {
      await performSaveSoul();
    }
  }

  if (authRequired) {
    return (
      <main className="panel-shell min-h-screen px-4 py-4 text-[var(--foreground)] sm:px-6 lg:px-8">
        {toast && <div className="toast-panel">{toast}</div>}

        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
          <section className="hero-panel w-full rounded-[2rem] p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-amber-100">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                Security · Locked
              </div>

              <h1 className="mt-5 text-[2.3rem] font-semibold tracking-[-0.06em] text-white sm:text-[3.6rem]">
                Protected access only.
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                Najpierw token. Dopiero po poprawnym odblokowaniu otworzy się cały dashboard główny.
                Bez kart, bez logów, bez akcji pod spodem.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-2xl security-panel rounded-[1.6rem] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={panelToken}
                  onChange={(event) => setPanelToken(event.target.value)}
                  className="security-input min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm text-white outline-none"
                  placeholder="Paste dashboard token"
                  type="password"
                />
                <button
                  onClick={savePanelToken}
                  className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold"
                  type="button"
                >
                  Unlock dashboard
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-left sm:grid-cols-2">
                <div className="info-block rounded-[1.2rem] p-4 text-sm text-[var(--muted)]">
                  <p className="font-medium text-white">What happens next</p>
                  <p className="mt-1">Po poprawnym tokenie otworzy się pełna strona główna z dash i akcjami.</p>
                </div>
                <div className="info-block rounded-[1.2rem] p-4 text-sm text-[var(--muted)]">
                  <p className="font-medium text-white">Local device only</p>
                  <p className="mt-1">Token zapisuje się lokalnie tylko w tej przeglądarce i można go potem wyczyścić.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="panel-shell min-h-screen px-4 pb-28 pt-4 text-[var(--foreground)] sm:px-6 sm:pb-8 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:gap-6">
        <section className="hero-panel rounded-[2rem] p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${tone.chip}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                  {tone.label}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--muted-2)]">
                  Security · {authStateLabel}
                </div>
              </div>

              <h1 className="mt-5 max-w-3xl text-[2.2rem] font-semibold tracking-[-0.06em] text-white sm:text-[3.4rem]">
                Premium control for AL.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
                Mobile-first dashboard do kontroli agenta, logów i SOUL. Bez chaosu, z mocniejszym
                zabezpieczeniem akcji i historią zmian.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
              <button
                onClick={() => loadDashboard(true)}
                className="ghost-button rounded-2xl px-4 py-3 text-sm font-medium text-white"
                type="button"
              >
                {refreshing ? "Refreshing..." : "Refresh now"}
              </button>
              <button
                onClick={() => openConfirm("restart")}
                disabled={restarting || authRequired}
                className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                type="button"
              >
                {restarting ? "Restarting..." : "Restart service"}
              </button>
            </div>
          </div>
        </section>

        {toast && <div className="toast-panel">{toast}</div>}

        {authRequired && (
          <section className="premium-card rounded-[1.8rem] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">Security</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Protected access</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Ten panel jest chroniony. Wklej token z `PANEL_AUTH_TOKEN`, zapisz go lokalnie w tej
                  przeglądarce i dopiero wtedy odblokuj akcje oraz dane.
                </p>
              </div>
              <div className="security-panel w-full max-w-xl rounded-[1.4rem] p-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={panelToken}
                    onChange={(event) => setPanelToken(event.target.value)}
                    className="security-input min-w-0 flex-1 rounded-2xl px-4 py-3 text-sm text-white outline-none"
                    placeholder="Paste dashboard token"
                    type="password"
                  />
                  <button onClick={savePanelToken} className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold" type="button">
                    Unlock panel
                  </button>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">Token zostaje zapisany lokalnie tylko w tej przeglądarce.</p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            eyebrow="Security"
            title="Access + audit"
            value={status?.authConfigured ? "Protected" : "Open"}
            detail={status?.auditLogPath ? `Audit: ${status.auditLogPath}` : "Audit file not configured."}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-6">
            <section className="premium-card rounded-[1.8rem] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">Operations</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Live logs</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Szybki podgląd życia kontenera. Z telefonu też ma być czytelnie, bez mikroskopu.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tailOptions.map((tail) => (
                    <button
                      key={tail}
                      onClick={() => setSelectedTail(tail)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedTail === tail
                          ? "border-[var(--accent)] bg-[var(--accent)]/16 text-white"
                          : "border-white/10 bg-white/[0.03] text-[var(--muted)]"
                      }`}
                      type="button"
                    >
                      Tail {tail}
                    </button>
                  ))}
                </div>
              </div>

              <div className="terminal-panel mt-5 rounded-[1.5rem] p-4 sm:p-5">
                {logsError ? (
                  <div className="text-sm text-rose-200">{logsError}</div>
                ) : loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="h-4 animate-pulse rounded bg-white/6" />
                    ))}
                  </div>
                ) : (
                  <pre className="log-scrollbar max-h-[420px] overflow-auto whitespace-pre-wrap text-[12px] leading-6 text-slate-200">
                    {logs?.logs || "No logs yet."}
                  </pre>
                )}
              </div>
            </section>

            <section className="premium-card rounded-[1.8rem] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">SOUL</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Personality editor</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Edytujesz charakter AL bez wchodzenia na serwer. Zapis jest bezpieczny i wpada do activity logu.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[var(--muted)]">
                  {soul?.exists ? "SOUL ready" : "SOUL will be created"}
                </span>
              </div>

              <textarea
                value={soulDraft}
                onChange={(event) => {
                  setSoulDraft(event.target.value);
                  setSoulDirty(true);
                }}
                className="editor-panel mt-5 min-h-[300px] w-full rounded-[1.5rem] p-4 text-sm outline-none transition"
                placeholder="Write AL soul / personality instructions here..."
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-xs text-[var(--muted)]">
                  <p>{soulDirty ? "Unsaved changes waiting for confirmation." : soul?.message || "Ready to edit."}</p>
                  <p className="break-all">Path: {status?.soulPath || soul?.path || "—"}</p>
                </div>
                <button
                  onClick={() => openConfirm("save")}
                  disabled={savingSoul || authRequired || !soulDirty}
                  className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                >
                  {savingSoul ? "Saving..." : "Review & save"}
                </button>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-6">
            <section className="premium-card rounded-[1.8rem] p-5 sm:p-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">Safety</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Guard rails</h2>

              <div className="mt-5 space-y-3 text-sm text-[var(--muted)]">
                <div className="info-block rounded-[1.2rem] p-4">
                  <p className="font-medium text-white">Protected actions</p>
                  <p className="mt-1">Restart i zapis SOUL wymagają osobnego potwierdzenia.</p>
                </div>
                <div className="info-block rounded-[1.2rem] p-4">
                  <p className="font-medium text-white">Session control</p>
                  <p className="mt-1">Możesz od razu wyczyścić lokalny token z tego urządzenia.</p>
                </div>
                <div className="info-block rounded-[1.2rem] p-4">
                  <p className="font-medium text-white">Diagnostics</p>
                  {statusError ? (
                    <p className="mt-1 text-rose-200">{statusError}</p>
                  ) : errorList.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-amber-100">
                      {errorList.map((error) => (
                        <li key={error}>• {error}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-emerald-200">No major issues detected.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="status-grid rounded-[1.2rem] p-4 text-sm">
                  <p className="text-[var(--muted)]">Compose path</p>
                  <p className="mt-1 break-all text-white">{status?.composePath || "—"}</p>
                </div>
                <div className="status-grid rounded-[1.2rem] p-4 text-sm">
                  <p className="text-[var(--muted)]">Compose service</p>
                  <p className="mt-1 break-all text-white">{status?.composeService || "hermes"}</p>
                </div>
                <div className="status-grid rounded-[1.2rem] p-4 text-sm">
                  <p className="text-[var(--muted)]">Local token</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-white">{panelToken ? "Present on this device" : "Not stored"}</p>
                    <button onClick={clearPanelToken} className="ghost-button rounded-xl px-3 py-2 text-xs text-white" type="button">
                      Clear token
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="premium-card rounded-[1.8rem] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">Activity</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Recent actions</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-[var(--muted)]">last 12</span>
              </div>

              <div className="mt-5 space-y-3">
                {auditError ? (
                  <div className="text-sm text-rose-200">{auditError}</div>
                ) : audit.length === 0 ? (
                  <div className="info-block rounded-[1.2rem] p-4 text-sm text-[var(--muted)]">No recent activity yet.</div>
                ) : (
                  audit.map((entry) => (
                    <div key={entry.id} className={`rounded-[1.2rem] border p-4 text-sm ${actionTone[entry.status]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{entry.action}</p>
                          <p className="mt-1 leading-6">{entry.detail}</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted-2)]">{entry.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                        <span>{relativeTime(entry.timestamp)}</span>
                        <span>{entry.ip}</span>
                        <span className="max-w-full truncate">{entry.userAgent}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      <div className="mobile-action-bar sm:hidden">
        <button onClick={() => loadDashboard(true)} className="ghost-button rounded-2xl px-4 py-3 text-sm text-white" type="button">
          Refresh
        </button>
        <button
          onClick={() => openConfirm("restart")}
          className="ghost-button rounded-2xl px-4 py-3 text-sm text-white"
          disabled={restarting || authRequired}
          type="button"
        >
          Restart
        </button>
        <button
          onClick={() => openConfirm("save")}
          className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold"
          disabled={savingSoul || authRequired || !soulDirty}
          type="button"
        >
          Save
        </button>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
          <div className="confirm-sheet w-full max-w-xl rounded-[1.8rem] p-5 sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-2)]">Confirm action</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
              {confirmAction === "restart" ? "Restart service" : "Save SOUL changes"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {confirmAction === "restart"
                ? "To zapyta Dockera o restart usługi hermes. Wpisz RESTART, żeby potwierdzić akcję."
                : "To zapisze nową wersję SOUL na serwerze i dopisze wpis do activity logu. Wpisz SAVE, żeby potwierdzić."}
            </p>

            <div className="mt-5 rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-[var(--muted)]">
              Required keyword: <span className="font-semibold tracking-[0.18em] text-white">{confirmKeyword}</span>
            </div>

            <input
              autoFocus
              className="security-input mt-4 w-full rounded-2xl px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setConfirmInput(event.target.value)}
              placeholder={`Type ${confirmKeyword}`}
              type="text"
              value={confirmInput}
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={closeConfirm} className="ghost-button rounded-2xl px-4 py-3 text-sm text-white" type="button">
                Cancel
              </button>
              <button
                onClick={confirmPrimaryAction}
                className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!confirmReady || restarting || savingSoul}
                type="button"
              >
                {confirmAction === "restart" ? (restarting ? "Restarting..." : "Confirm restart") : savingSoul ? "Saving..." : "Confirm save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
