import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import {
  workspaces,
  workspaceMembers,
  entries,
  NewWorkspace,
} from "@stashbox/db/schema";
import { eq, and, ilike, sql, or, desc, ne } from "drizzle-orm";

export interface CreateWorkspaceParams {
  ownerId: string;
  name: string;
  handle: string;
  type?: "personal" | "team";
  visibility?: "private" | "public";
  parentId?: string;
}

export interface ListWorkspacesParams {
  userId: string;
  page?: number;
  limit?: number;
}

export interface AddWorkspaceMemberParams {
  workspaceId: string;
  requesterId: string;
  targetUserId: string;
  role: "owner" | "qa" | "member";
}

export interface ForkWorkspaceParams {
  sourceWorkspaceId: string;
  userId: string;
  name?: string;
  handle: string;
  visibility?: "private" | "public";
  destinationParentId?: string;
  includeChildren?: boolean;
}

export class WorkspacesService {
  static async listUserWorkspaces({
    userId,
    page = 1,
    limit = 20,
  }: ListWorkspacesParams) {
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));

    const total = Number(countResult?.count ?? 0);

    const rows = await db
      .select({
        workspace: workspaces,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(
        workspaces,
        eq(workspaceMembers.workspaceId, workspaces.workspaceId),
      )
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(desc(workspaces.updatedAt))
      .limit(validLimit)
      .offset(offset);

    return {
      workspaces: rows.map(({ workspace, role, joinedAt }) => ({
        ...workspace,
        role,
        joinedAt,
      })),
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  static async explorePublicWorkspaces({
    page = 1,
    limit = 20,
    search,
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    const conditions = [eq(workspaces.visibility, "public")];
    const term = search?.trim();
    if (term) {
      const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
      const match = or(
        ilike(workspaces.name, pattern),
        ilike(workspaces.handle, pattern),
      );
      if (match) conditions.push(match);
    }

    const where = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaces)
      .where(where);

    const total = Number(countResult?.count ?? 0);

    const items = await db
      .select()
      .from(workspaces)
      .where(where)
      .orderBy(desc(workspaces.updatedAt))
      .limit(validLimit)
      .offset(offset);

    return {
      workspaces: items,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  static async assertWorkspaceAccess(
    workspaceId: string,
    userId?: string,
    requireWrite = false,
  ) {
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.workspaceId, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new AppError(404, "Workspace not found", "WORKSPACE_NOT_FOUND");
    }

    if (!userId) {
      if (workspace.visibility === "public" && !requireWrite) {
        return { workspace, role: null };
      }
      throw new AppError(401, "Authentication required", "UNAUTHORIZED");
    }

    const [membership] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      if (workspace.visibility === "public" && !requireWrite) {
        return { workspace, role: null };
      }
      throw new AppError(403, "Access denied to this workspace", "FORBIDDEN");
    }

    return { workspace, role: membership.role };
  }

  static async createWorkspace({
    ownerId,
    name,
    handle,
    type = "personal",
    visibility = "private",
    parentId,
  }: CreateWorkspaceParams) {
    return await db.transaction(async (tx) => {
      if (parentId) {
        const [parent] = await tx
          .select({ id: workspaces.workspaceId })
          .from(workspaces)
          .where(eq(workspaces.workspaceId, parentId))
          .limit(1);

        if (!parent) {
          throw new AppError(
            404,
            "Parent workspace not found",
            "PARENT_NOT_FOUND",
          );
        }
      }

      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name,
          handle,
          type,
          visibility,
          parentId: parentId || null,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.workspaceId,
        userId: ownerId,
        role: "owner",
      });

      return workspace;
    });
  }

  static async changeWorkspaceVisibility(
    workspaceId: string,
    requesterId: string,
    visibility: "private" | "public",
  ) {
    const { role } = await this.assertWorkspaceAccess(
      workspaceId,
      requesterId,
      true,
    );
    if (role !== "owner") {
      throw new AppError(403, "Only owners can update visibility", "FORBIDDEN");
    }

    const [updated] = await db
      .update(workspaces)
      .set({ visibility, updatedAt: new Date() })
      .where(eq(workspaces.workspaceId, workspaceId))
      .returning();

    return updated;
  }

  static async getWorkspaceMembers(
    workspaceId: string,
    requesterId: string,
    page = 1,
    limit = 20,
  ) {
    await this.assertWorkspaceAccess(workspaceId, requesterId, false);

    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (validPage - 1) * validLimit;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    const total = Number(countResult?.count ?? 0);

    const members = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .limit(validLimit)
      .offset(offset);

    return {
      members,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  static async addMember({
    workspaceId,
    requesterId,
    targetUserId,
    role,
  }: AddWorkspaceMemberParams) {
    const { role: requesterRole } = await this.assertWorkspaceAccess(
      workspaceId,
      requesterId,
      true,
    );

    if (requesterRole !== "owner") {
      throw new AppError(403, "Only owners can manage members", "FORBIDDEN");
    }

    const [membership] = await db
      .insert(workspaceMembers)
      .values({ workspaceId, userId: targetUserId, role })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role },
      })
      .returning();

    return membership;
  }

  static async changeMemberRole(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
    role: "owner" | "qa" | "member",
  ) {
    const { role: requesterRole } = await this.assertWorkspaceAccess(
      workspaceId,
      requesterId,
      true,
    );

    if (requesterRole !== "owner") {
      throw new AppError(403, "Only owners can change roles", "FORBIDDEN");
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .returning();

    if (!updated) {
      throw new AppError(404, "Member not found", "MEMBER_NOT_FOUND");
    }
    return updated;
  }

  static async removeMember(
    workspaceId: string,
    requesterId: string,
    targetUserId: string,
  ) {
    const { role: requesterRole } = await this.assertWorkspaceAccess(
      workspaceId,
      requesterId,
      true,
    );

    if (requesterRole !== "owner" && requesterId !== targetUserId) {
      throw new AppError(403, "Insufficient permissions", "FORBIDDEN");
    }

    const [deleted] = await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new AppError(404, "Member not found", "MEMBER_NOT_FOUND");
    }
    return deleted;
  }

  /**
   * Deep-clones a workspace, its accessible entries, and child sub-workspaces.
   */
  static async forkWorkspace({
    sourceWorkspaceId,
    userId,
    name,
    handle,
    visibility = "private",
    destinationParentId,
    includeChildren = true,
  }: ForkWorkspaceParams) {
    const { workspace: sourceWorkspace, role: sourceRole } =
      await this.assertWorkspaceAccess(sourceWorkspaceId, userId, false);

    if (destinationParentId) {
      await this.assertWorkspaceAccess(destinationParentId, userId, true);
    }

    return await db.transaction(async (tx) => {
      const cloneNode = async (
        srcWs: typeof workspaces.$inferSelect,
        targetName: string,
        targetHandle: string,
        parentId: string | null,
      ): Promise<typeof workspaces.$inferSelect> => {
        const newWorkspaceValues: NewWorkspace = {
          name: targetName,
          handle: targetHandle,
          type: "personal",
          visibility,
          parentId,
          forkedFromId: srcWs.workspaceId,
        };

        const [newWs] = await tx
          .insert(workspaces)
          .values(newWorkspaceValues)
          .returning();

        await tx.insert(workspaceMembers).values({
          workspaceId: newWs.workspaceId,
          userId,
          role: "owner",
        });

        // Public viewers only clone published entries; members also clone their own drafts
        const entryFilter = !sourceRole
          ? and(
              eq(entries.workspaceId, srcWs.workspaceId),
              eq(entries.status, "qa_approved"),
            )
          : and(
              eq(entries.workspaceId, srcWs.workspaceId),
              or(ne(entries.status, "draft"), eq(entries.createdBy, userId)),
            );

        const sourceEntries = await tx
          .select()
          .from(entries)
          .where(entryFilter);

        if (sourceEntries.length > 0) {
          await tx.insert(entries).values(
            sourceEntries.map((entry) => ({
              workspaceId: newWs.workspaceId,
              createdBy: userId,
              updatedBy: userId,
              type: entry.type,
              title: entry.title,
              description: entry.description,
              code: entry.code,
              language: entry.language,
              notes: entry.notes,
              gotchas: entry.gotchas,
              dosAndDonts: entry.dosAndDonts,
              targetRuntimes: entry.targetRuntimes,
              tags: entry.tags,
              status: "qa_approved" as const,
              verifiedBy: userId,
              verifiedAt: new Date(),
              version: 1,
              forkedFromId: entry.entryId,
              forkedFromVersion: entry.version,
            })),
          );
        }

        if (includeChildren) {
          const children = await tx
            .select()
            .from(workspaces)
            .where(eq(workspaces.parentId, srcWs.workspaceId));

          for (const child of children) {
            const childHandle = `${targetHandle}-${child.handle}`.slice(0, 100);
            await cloneNode(child, child.name, childHandle, newWs.workspaceId);
          }
        }

        return newWs;
      };

      return await cloneNode(
        sourceWorkspace,
        name ?? `${sourceWorkspace.name} (Fork)`,
        handle,
        destinationParentId ?? null,
      );
    });
  }
}
