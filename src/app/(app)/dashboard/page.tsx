import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookieStore } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";
import { LogoutButton } from "./logout-button";
import { CreateDocumentButton } from "./create-document-button";

function DocumentList({
  documents,
}: {
  documents: { id: string; title: string; updatedAt: Date }[];
}) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-500">None yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link href={`/documents/${doc.id}`} className="underline">
            {doc.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUserFromCookieStore(cookies());
  const { owned, shared } = user
    ? await listDocumentsForUser(user.id)
    : { owned: [], shared: [] };

  return (
    <main className="flex min-h-screen flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Logged in as {user?.username}
        </h1>
        <LogoutButton />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">My documents</h2>
        <CreateDocumentButton />
      </div>
      <DocumentList documents={owned} />

      <h2 className="text-lg font-semibold">Shared with me</h2>
      <DocumentList documents={shared} />
    </main>
  );
}
