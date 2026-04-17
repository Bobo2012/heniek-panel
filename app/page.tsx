"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white p-10">
      <h1 className="text-4xl font-bold mb-6">Al Panel</h1>

      <div className="grid grid-cols-3 gap-6">
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
          <p>View system logs</p>
        </div>
      </div>
    </main>
  );
}