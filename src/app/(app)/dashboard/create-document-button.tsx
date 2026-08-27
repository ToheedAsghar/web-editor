"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateDocumentButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: "{}" });
      if (!res.ok) return;
      const document = await res.json();
      router.push(`/documents/${document.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <button onClick={handleCreate} disabled={creating} className="border p-2">
      {creating ? "Creating…" : "New document"}
    </button>
  );
}
