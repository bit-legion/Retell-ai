import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, orgMemberships } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export type UserRole = "owner" | "admin" | "member";

export async function requireAuth(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  
  if (!session?.user) {
    return null;
  }

  return session.user;
}

export async function requireOrgRole(
  request: NextRequest,
  orgId: string,
  requiredRole: UserRole
) {
  const user = await requireAuth(request);
  
  if (!user) {
    return null;
  }

  const [membership] = await db
    .select()
    .from(orgMemberships)
    .where(
      and(
        eq(orgMemberships.userId, user.id),
        eq(orgMemberships.orgId, orgId)
      )
    )
    .limit(1);

  if (!membership) {
    return null;
  }

  // Role hierarchy: owner > admin > member
  const roleHierarchy: Record<UserRole, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
    return null;
  }

  return { user, membership };
}

/**
 * Check if user is member of organization
 */
export async function requireOrgMember(request: NextRequest, orgId: string) {
  return requireOrgRole(request, orgId, "member");
}

/**
 * Middleware helper for API routes
 */
export function createAuthGuard(
  handler: (request: NextRequest, user: NonNullable<Awaited<ReturnType<typeof requireAuth>>>) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const user = await requireAuth(request);
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

/**
 * Middleware helper for org-protected routes
 */
export function createOrgGuard(
  handler: (
    request: NextRequest,
    user: NonNullable<Awaited<ReturnType<typeof requireAuth>>>,
    membership: NonNullable<Awaited<ReturnType<typeof requireOrgRole>>>
  ) => Promise<NextResponse>,
  requiredRole: UserRole = "member"
) {
  return async (request: NextRequest) => {
    const orgId = request.nextUrl.searchParams.get("orgId") ||
                   request.headers.get("x-org-id") ||
                   (await request.json()).orgId;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const result = await requireOrgRole(request, orgId, requiredRole);
    
    if (!result) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return handler(request, result.user, result.membership);
  };
}
