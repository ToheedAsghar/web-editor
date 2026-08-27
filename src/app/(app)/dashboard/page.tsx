import { cookies } from "next/headers";
import { getCurrentUserFromCookieStore } from "@/lib/auth";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const user = await getCurrentUserFromCookieStore(cookies());

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Logged in as {user?.username}
        </h1>
        <LogoutButton />
      </div>
    </main>
  );
}
