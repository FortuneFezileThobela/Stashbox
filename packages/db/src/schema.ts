import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const workspaceTypeEnum = pgEnum("workspace_type", ["personal", "team"]);
export const workspaceVisibilityEnum = pgEnum("workspace_visibility", [
  "private",
  "public",
]);
export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "qa",
  "member",
]);
export const entryTypeEnum = pgEnum("entry_type", ["snippet", "note"]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "draft",
  "pending_qa",
  "qa_approved",
  "deprecated",
]);
export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "resolved",
  "closed",
]);
export const proposalTypeEnum = pgEnum("proposal_type", [
  "new_entry",
  "update_entry",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);

export interface DoAndDontRule {
  type: "do" | "dont";
  rule: string;
  explanation: string;
}

//  Users Table
export const users = pgTable("users", {
  userId: uuid("user_id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  jobTitle: varchar("job_title", { length: 100 }),
  organization: varchar("organization", { length: 120 }),
  bio: text("bio"),
  primaryLanguages: text("primary_languages")
    .array()
    .default(sql`'{}'::text[]`)
    .notNull(),
  githubId: varchar("github_id", { length: 255 }).unique(),
  profileUrl: text("profile_url"),
  themePreference: varchar("theme_preference", { length: 16 })
    .default("dark")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// API Tokens Table
export const apiTokens = pgTable(
  "api_tokens",
  {
    tokenId: uuid("token_id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 100 })
      .default("VS Code Extension")
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashIndex: index("index_api_token_hash").on(table.tokenHash),
    userIndex: index("index_api_token_user").on(table.userId),
  }),
);

// Workspaces Table (Now governs visibility for all contained entries)
export const workspaces = pgTable(
  "workspaces",
  {
    workspaceId: uuid("workspace_id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    handle: varchar("handle", { length: 100 }).notNull().unique(),
    type: workspaceTypeEnum("type").default("personal").notNull(),
    visibility: workspaceVisibilityEnum("visibility")
      .default("private")
      .notNull(),
    parentId: uuid("parent_id").references((): any => workspaces.workspaceId, {
      onDelete: "cascade",
    }),
    forkedFromId: uuid("forked_from_id").references(
      (): any => workspaces.workspaceId,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    parentIdIndex: index("index_workspace_parent").on(table.parentId),
    visibilityIndex: index("index_workspace_visibility").on(table.visibility),
  }),
);

// Workspace Members Table
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    memberId: uuid("member_id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    memberUniq: uniqueIndex("unique_workspace_member").on(
      table.workspaceId,
      table.userId,
    ),
    userLookupIndex: index("index_workspace_members_user").on(table.userId),
  }),
);

// Entries Table (Protected by workspace visibility + safe non-destructive forking)
export const entries = pgTable(
  "entries",
  {
    entryId: uuid("entry_id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: "cascade" }),
    type: entryTypeEnum("type").default("snippet").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    code: text("code"),
    language: varchar("language", { length: 50 }),
    notes: text("notes").notNull(),
    gotchas: text("gotchas"),
    dosAndDonts: jsonb("dos_and_donts")
      .$type<DoAndDontRule[]>()
      .default([])
      .notNull(),
    targetRuntimes: text("target_runtimes").array().default([]).notNull(),
    tags: text("tags").array().default([]).notNull(),
    status: approvalStatusEnum("status").default("draft").notNull(),
    version: integer("version").default(1).notNull(),
    verifiedBy: uuid("verified_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    forkedFromId: uuid("forked_from_id").references(
      (): any => entries.entryId,
      {
        onDelete: "set null",
      },
    ),
    forkedFromVersion: integer("forked_from_version"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    updatedBy: uuid("updated_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceIndex: index("index_entries_workspace").on(table.workspaceId),
    statusIndex: index("index_entries_status").on(table.status),
    languageIndex: index("index_entries_language").on(table.language),
    forkedIndex: index("index_entries_forked").on(table.forkedFromId),
    shapecheck: check(
      "check_entry_shape",
      sql`("type"='snippet' AND "code" IS NOT NULL AND "language" IS NOT NULL) OR ("type"='note')`,
    ),
    tagsIndex: index("index_entries_tags").on(table.tags),
  }),
);

// Discussion Threads Table
export const discussionThreads = pgTable(
  "discussion_threads",
  {
    threadId: uuid("thread_id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.entryId, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    status: threadStatusEnum("status").default("open").notNull(),
    body: text("body").notNull(),
    codeContext: text("context_code"),
    contextLanguage: varchar("context_language", { length: 100 }),
    lineStart: integer("line_start"),
    lineEnd: integer("line_end"),
    snippetVersionPinned: integer("snippet_version_pinned")
      .default(1)
      .notNull(),
    codeSnapshot: text("code_snapshot"),
    resolutionSummary: text("resolution_summary"),
    resolvedBy: uuid("resolved_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    entryIndex: index("index_thread_entry").on(table.entryId),
    linecheck: check(
      "check_line_range",
      sql`("line_start" IS NULL AND "line_end" IS NULL) OR ("line_start" IS NOT NULL AND "line_end" IS NOT NULL AND "line_start" <= "line_end")`,
    ),
  }),
);

// Discussion Comments Table
export const discussionComments = pgTable(
  "discussion_comments",
  {
    commentId: uuid("comment_id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => discussionThreads.threadId, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    content: text("content").notNull(),
    codeBlock: text("code_block"),
    codeLanguage: varchar("code_language", { length: 100 }),
    isSuggestion: boolean("is_suggestion").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIndex: index("index_comment_thread").on(table.threadId),
  }),
);

//Entry Proposals Table (Supports direct suggestions and cross-workspace fork merges)
export const entryProposals = pgTable(
  "entry_proposals",
  {
    proposalId: uuid("proposal_id").defaultRandom().primaryKey(),
    targetWorkspaceId: uuid("targeted_workspace_id")
      .notNull()
      .references(() => workspaces.workspaceId, { onDelete: "cascade" }),
    targetEntryId: uuid("targeted_entry_id").references(() => entries.entryId, {
      onDelete: "cascade",
    }),
    sourceEntryId: uuid("source_entry_id").references(() => entries.entryId, {
      onDelete: "set null",
    }),
    type: proposalTypeEnum("type").notNull(),
    entryType: entryTypeEnum("entry_type").default("snippet").notNull(),
    status: proposalStatusEnum("status").default("pending").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    code: text("code"),
    language: varchar("language", { length: 100 }),
    notes: text("notes").notNull(),
    gotchas: text("gotchas"),
    dosAndDonts: jsonb("dos_and_donts")
      .$type<DoAndDontRule[]>()
      .default([])
      .notNull(),
    targetRuntimes: text("target_runtimes").array().default([]).notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.userId, { onDelete: "cascade" }),
    reviewedBy: uuid("reviewed_by").references(() => users.userId, {
      onDelete: "set null",
    }),
    reviewFeedback: text("review_feedback"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    targetWorkspaceIndex: index("index_proposals_workspace").on(
      table.targetWorkspaceId,
    ),
    targetEntryIndex: index("index_entry_target_entry").on(table.targetEntryId),
    sourceEntryIndex: index("index_proposal_source_entry").on(
      table.sourceEntryId,
    ),
    shapecheck: check(
      "check_proposal_entry_shape",
      sql`("entry_type"='snippet' AND "code" IS NOT NULL AND "language" IS NOT NULL) OR ("entry_type"='note')`,
    ),
    targetcheck: check(
      "check_proposal_target",
      sql`("type"='new_entry' AND "targeted_entry_id" IS NULL) OR ("type"='update_entry' AND "targeted_entry_id" IS NOT NULL)`,
    ),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
  entries: many(entries),
  tokens: many(apiTokens),
  comments: many(discussionComments),
  proposals: many(entryProposals),
}));

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.userId],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  parent: one(workspaces, {
    fields: [workspaces.parentId],
    references: [workspaces.workspaceId],
    relationName: "workspace_hierarchy",
  }),
  children: many(workspaces, { relationName: "workspace_hierarchy" }),
  members: many(workspaceMembers),
  entries: many(entries),
  proposals: many(entryProposals),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.workspaceId],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.userId],
    }),
  }),
);

export const entriesRelations = relations(entries, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [entries.workspaceId],
    references: [workspaces.workspaceId],
  }),
  author: one(users, {
    fields: [entries.createdBy],
    references: [users.userId],
  }),
  verifier: one(users, {
    fields: [entries.verifiedBy],
    references: [users.userId],
  }),
  origin: one(entries, {
    fields: [entries.forkedFromId],
    references: [entries.entryId],
    relationName: "entry_lineage",
  }),
  forks: many(entries, { relationName: "entry_lineage" }),
  threads: many(discussionThreads),
  proposals: many(entryProposals, { relationName: "target_entry_proposals" }),
}));

export const discussionThreadsRelations = relations(
  discussionThreads,
  ({ one, many }) => ({
    entry: one(entries, {
      fields: [discussionThreads.entryId],
      references: [entries.entryId],
    }),
    author: one(users, {
      fields: [discussionThreads.createdBy],
      references: [users.userId],
    }),
    resolver: one(users, {
      fields: [discussionThreads.resolvedBy],
      references: [users.userId],
    }),
    comments: many(discussionComments),
  }),
);

export const discussionCommentsRelations = relations(
  discussionComments,
  ({ one }) => ({
    thread: one(discussionThreads, {
      fields: [discussionComments.threadId],
      references: [discussionThreads.threadId],
    }),
    author: one(users, {
      fields: [discussionComments.authorId],
      references: [users.userId],
    }),
  }),
);

export const entryProposalsRelations = relations(entryProposals, ({ one }) => ({
  targetWorkspace: one(workspaces, {
    fields: [entryProposals.targetWorkspaceId],
    references: [workspaces.workspaceId],
  }),
  targetEntry: one(entries, {
    fields: [entryProposals.targetEntryId],
    references: [entries.entryId],
    relationName: "target_entry_proposals",
  }),
  sourceEntry: one(entries, {
    fields: [entryProposals.sourceEntryId],
    references: [entries.entryId],
  }),
  author: one(users, {
    fields: [entryProposals.authorId],
    references: [users.userId],
  }),
  reviewer: one(users, {
    fields: [entryProposals.reviewedBy],
    references: [users.userId],
  }),
}));

// Runtime Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type DiscussionThread = typeof discussionThreads.$inferSelect;
export type NewDiscussionThread = typeof discussionThreads.$inferInsert;

export type DiscussionComment = typeof discussionComments.$inferSelect;
export type NewDiscussionComment = typeof discussionComments.$inferInsert;

export type EntryProposal = typeof entryProposals.$inferSelect;
export type NewEntryProposal = typeof entryProposals.$inferInsert;
