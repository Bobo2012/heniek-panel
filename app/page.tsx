"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  const [logs, setLogs] = useState("Loading logs...");

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
      })
      .catch(() => setStatus("error"));

    fetch("/api/logs")
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs || "No logs found.");
      })
      .catch(() => setLogs("Could not load logs."));
  }, []);

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white p-10">
      <h1 className="text-4xl font-bold mb-6">AL Panel</h1>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="p-6 bg-[#1a1a1a] rounded-2xl">
          <h2 className="text-xl mb-2">Status</h2>
          <p>Hermes: {status}</p>
        </div>

        <div className="p-6 bg-[#1a1a1a] rounded-2xl">
          <h2 className="text-xl mb-2">Soul</h2>
          <p>Edit personality</p>
        </div>

        <div className="p-6 bg-[#1a1a1a] rounded-2xl">
          <h2 className="text-xl mb-2">Logs</h2>
          <p>Live system logs</p>
        </div>
      </div>

      <div className="p-6 bg-[#1a1a1a] rounded-2xl">
        <h2 className="text-xl mb-4">Hermes Logs</h2>
        <pre className="whitespace-pre-wrap text-sm text-neutral-300 overflow-x-auto">
          {logs}
        </pre>
      </div>
    </main>
  );
}