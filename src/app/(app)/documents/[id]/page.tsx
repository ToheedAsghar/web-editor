import { cookies } from "next/headers";
import type { JSONContent } from "@tiptap/react";
import { getCurrentUserFromCookieStore } from "@/lib/auth";
import { canView } from "@/lib/access-control";
import { prisma } from "@/lib/db";
import { DocumentEditor } from "./document-editor";

export default async function DocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUserFromCookieStore(cookies());
  if (!user || !(await canView(user.id, params.id))) {
    // Same message whether the document doesn't exist or simply isn't
    // shared with this user -- never leak document existence.
    return (
      <main className="p-8">
        <p>You don&apos;t have access to this document.</p>
      </main>
    );
  }

  // canView already confirmed this document exists and this user can see it.
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: params.id },
  });

  return (
    <DocumentEditor
      documentId={document.id}
      initialTitle={document.title}
      initialContent={document.content as JSONContent}
    />
  );
}
