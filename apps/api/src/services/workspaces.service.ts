import crypto from "node:crypto";
import { AppError } from "../middleware/errorHandler.js";
import { db } from "@stashbox/db";
import {
  workspaces,
  workspaceMembers,
  entries,
  NewWorkspace,
} from "@stashbox/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

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
  /**
   * Lists all workspaces where the user is a member or owner
   */
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

    const response = await db
      .select()
      .from(workspaceMembers)
      .innerJoin(
        workspaces,
        eq(workspaceMembers.workspaceId, workspaces.workspaceId),
      )
      .where(eq(workspaceMembers.userId, userId))
      .limit(validLimit)
      .offset(offset);

    return {
      workspaces: response,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }
  /**
   * Verifies if a user can read or write to a workspace
   */
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

  /**
   * Creates a workspace and assigns the creator as an 'owner' member in a transaction
   */
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

  /**
   * Adds or updates a member inside a workspace after verifying owner permissions
   */
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
      throw new AppError(
        403,
        "Only workspace owners can manage members",
        "FORBIDDEN",
      );
    }

    const [membership] = await db
      .insert(workspaceMembers)
      .values({
        workspaceId,
        userId: targetUserId,
        role,
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role },
      })
      .returning();

    return membership;
  }

  /**
   * Deep-copies an entire workspace, its entries, and (optionally) its child workspace tree
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
    // Verify the user has read access to the source workspace
    const { workspace: sourceWorkspace } = await this.assertWorkspaceAccess(
      sourceWorkspaceId,
      userId,
      false,
    );

    //If forking into an existing parent workspace, verify write access there
    if (destinationParentId) {
      await this.assertWorkspaceAccess(destinationParentId, userId, true);
    }

    return await db.transaction(async (tx) => {
      // Recursive helper to clone a workspace node, its entries, and its children
      const cloneNode = async (
        srcWs: typeof workspaces.$inferSelect,
        targetName: string,
        targetHandle: string,
        parentId: string | null,
      ): Promise<typeof workspaces.$inferSelect> => {
        // Create the new workspace container

        const newWorkspaceValues: NewWorkspace = {
          name: targetName,
          handle: targetHandle,
          type: "personal",
          visibility,
          parentId: parentId ?? null,
          forkedFromId: srcWs.workspaceId,
        };
        const [newWs] = await tx
          .insert(workspaces)
          .values(newWorkspaceValues)
          .returning();

        // Assign the forking user as the 'owner' of the new workspace
        await tx.insert(workspaceMembers).values({
          workspaceId: newWs.workspaceId,
          userId,
          role: "owner",
        });

        // Fetch all entries in the source workspace and bulk-copy them
        const sourceEntries = await tx
          .select()
          .from(entries)
          .where(eq(entries.workspaceId, srcWs.workspaceId));

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
              status: "draft" as const,
              version: 1,
              forkedFromId: entry.entryId,
              forkedFromVersion: entry.version,
            })),
          );
        }

        // Optionally deep-copy child sub-workspaces recursively
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
