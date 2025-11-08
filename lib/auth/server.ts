import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Get the current session on the server
 */
export async function getSession() {
  const headersList = await headers();
  return await auth.api.getSession({ headers: headersList });
}

/**
 * Require authentication on server components
 * Redirects to login if not authenticated
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session?.user) {
    redirect("/login");
  }

  return session;
}
