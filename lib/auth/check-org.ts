import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, orgMemberships } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * Check if user has any organizations
 */
export async function hasOrganizations(userId: string): Promise<boolean> {
  const memberships = await db
    .select()
    .from(orgMemberships)
    .where(eq(orgMemberships.userId, userId))
    .limit(1);

  return memberships.length > 0;
}

/**
 * Check if user needs to create an organization
 */
export async function requiresOrganization(): Promise<boolean> {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session?.user) {
    return false;
  }

  const hasOrgs = await hasOrganizations(session.user.id);
  return !hasOrgs;
}
