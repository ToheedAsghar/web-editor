"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Toolbar } from "./toolbar";

const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DocumentEditor({
  documentId,
  initialTitle,
  initialContent,
}: {
  documentId: string;
  initialTitle: string;
  initialContent: JSONContent;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (data: { title?: string; content?: JSONContent }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setStatus("saving");
        try {
          const res = await fetch(`/api/documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          setStatus(res.ok ? "saved" : "error");
        } catch {
          setStatus("error");
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [documentId]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editor = useEditor({
    // Next.js renders this Client Component on the server first; without
    // this, TipTap tries to render immediately during SSR and produces a
    // hydration mismatch on the client.
    immediatelyRender: false,
    extensions: [
      // StarterKit v3 registers its own underline mark by default, which
      // would conflict with the explicit Underline extension below.
      StarterKit.configure({ underline: false }),
      Underline,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      save({ content: editor.getJSON() });
    },
  });

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTitle(value);
    save({ title: value });
  }

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Error saving"
          : "";

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <div className="flex items-center justify-between gap-4">
        <input
          value={title}
          onChange={handleTitleChange}
          className="flex-1 border-b p-1 text-xl font-semibold"
        />
        <span className="text-sm text-gray-500">{statusLabel}</span>
      </div>
      {editor ? (
        <>
          <Toolbar editor={editor} />
          <EditorContent
            editor={editor}
            className="min-h-[300px] border p-4 [&_.ProseMirror]:outline-none"
          />
        </>
      ) : (
        <p className="text-sm text-gray-500">Loading editor…</p>
      )}
    </main>
  );
}
