import crypto from "node:crypto";
import { db } from "./index.js";
import {
  users,
  apiTokens,
  workspaces,
  workspaceMembers,
  entries,
  discussionThreads,
  discussionComments,
  entryProposals,
} from "./schema.js";

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

async function seed() {
  console.log("🌱 Starting database seeding...");

  // 1. Clean existing data (respecting foreign key cascades)
  await db.delete(entryProposals);
  await db.delete(discussionComments);
  await db.delete(discussionThreads);
  await db.delete(entries);
  await db.delete(workspaceMembers);
  await db.delete(workspaces);
  await db.delete(apiTokens);
  await db.delete(users);

  console.log("🧹 Cleared existing tables.");

  // 2. Seed Users
  const passwordHash = crypto
    .createHash("sha256")
    .update("Password123!")
    .digest("hex");

  const [alice, bob, charlie, dave] = await db
    .insert(users)
    .values([
      {
        email: "alice@stashbox.local",
        username: "alice_eng",
        fullName: "Alice Sterling",
        passwordHash,
        jobTitle: "Principal Architect",
        organization: "Stashbox Core",
        bio: "Distributed systems enthusiast and backend architecture lead.",
        primaryLanguages: ["TypeScript", "Go", "Rust"],
        themePreference: "dark",
      },
      {
        email: "bob@stashbox.local",
        username: "bob_qa",
        fullName: "Bob Jenkins",
        passwordHash,
        jobTitle: "Staff QA Engineer",
        organization: "Stashbox Core",
        bio: "Enforcing rigorous four-eyes review and code quality standards.",
        primaryLanguages: ["TypeScript", "Python"],
        themePreference: "dark",
      },
      {
        email: "charlie@stashbox.local",
        username: "charlie_dev",
        fullName: "Charlie Chen",
        passwordHash,
        jobTitle: "Fullstack Developer",
        organization: "Stashbox Core",
        bio: "Building robust developer tooling and React frontend components.",
        primaryLanguages: ["TypeScript", "HTML/CSS"],
        themePreference: "light",
      },
      {
        email: "dave@stashbox.local",
        username: "dave_open",
        fullName: "Dave OpenSource",
        passwordHash,
        jobTitle: "Community Contributor",
        organization: "External",
        bio: "Open source contributor exploring public snippet libraries.",
        primaryLanguages: ["Python", "JavaScript"],
        themePreference: "dark",
      },
    ])
    .returning();

  console.log(
    `👤 Created 4 users: ${alice.username}, ${bob.username}, ${charlie.username}, ${dave.username}`,
  );

  // 3. Seed API Tokens (Bearer token format: sbx_live_Password123!)
  const rawToken = "sbx_live_Password123!";
  await db.insert(apiTokens).values([
    {
      userId: alice.userId,
      tokenHash: hashToken(rawToken),
      name: "Alice VS Code Extension",
    },
    {
      userId: bob.userId,
      tokenHash: hashToken("sbx_live_bobtoken"),
      name: "Bob CLI Tool",
    },
  ]);

  // 4. Seed Workspaces (Personal, Team Private, Team Public)
  const [alicePersonal, coreTeamPrivate, communityPublic] = await db
    .insert(workspaces)
    .values([
      {
        name: "Alice's Sandbox",
        handle: "alice-sandbox",
        type: "personal",
        visibility: "private",
      },
      {
        name: "Core Backend Engineering",
        handle: "core-backend",
        type: "team",
        visibility: "private",
      },
      {
        name: "Public Patterns & Runbooks",
        handle: "public-patterns",
        type: "team",
        visibility: "public",
      },
    ])
    .returning();

  console.log(
    `📂 Created 3 workspaces: ${alicePersonal.name}, ${coreTeamPrivate.name}, ${communityPublic.name}`,
  );

  // 5. Seed Workspace Memberships & Roles
  await db.insert(workspaceMembers).values([
    // Alice's personal workspace
    {
      workspaceId: alicePersonal.workspaceId,
      userId: alice.userId,
      role: "owner",
    },
    // Core Backend Team (Alice = owner, Bob = qa, Charlie = member)
    {
      workspaceId: coreTeamPrivate.workspaceId,
      userId: alice.userId,
      role: "owner",
    },
    {
      workspaceId: coreTeamPrivate.workspaceId,
      userId: bob.userId,
      role: "qa",
    },
    {
      workspaceId: coreTeamPrivate.workspaceId,
      userId: charlie.userId,
      role: "member",
    },
    // Public Community Library (Alice = owner, Dave = member)
    {
      workspaceId: communityPublic.workspaceId,
      userId: alice.userId,
      role: "owner",
    },
    {
      workspaceId: communityPublic.workspaceId,
      userId: dave.userId,
      role: "member",
    },
  ]);

  // 6. Seed Entries across all statuses and types
  const [entry1, entry2, entry3, entry4, entry5] = await db
    .insert(entries)
    .values([
      // Approved Snippet in Core Backend
      {
        workspaceId: coreTeamPrivate.workspaceId,
        type: "snippet",
        title: "Robust JWT Bearer Authentication Middleware",
        description:
          "Express middleware verifying RS256 / HS256 tokens with timing-safe comparison.",
        code: "export function requireAuth(req: Request, res: Response, next: NextFunction) {\n  const authHeader = req.headers.authorization;\n  if (!authHeader?.startsWith('Bearer ')) {\n    throw new AppError(401, 'Unauthorized', 'UNAUTHORIZED');\n  }\n  next();\n}",
        language: "typescript",
        notes:
          "Ensure secret key rotation is configured in environment variables.",
        gotchas: "Never log raw authorization headers or bearer tokens.",
        dosAndDonts: [
          {
            type: "do",
            rule: "Always check header prefix",
            explanation: "Prevents malformed auth parsing.",
          },
          {
            type: "dont",
            rule: "Hardcode JWT secrets",
            explanation: "Leads to severe security vulnerabilities.",
          },
        ],
        targetRuntimes: ["Node.js 20+", "Bun"],
        tags: ["auth", "security", "middleware"],
        status: "qa_approved",
        version: 1,
        verifiedBy: bob.userId,
        verifiedAt: new Date(),
        createdBy: alice.userId,
        updatedBy: alice.userId,
      },
      // Pending QA Snippet in Core Backend
      {
        workspaceId: coreTeamPrivate.workspaceId,
        type: "snippet",
        title: "PostgreSQL Connection Pool with Drizzle ORM",
        description:
          "Optimized connection pool configuration with SSL and statement timeouts.",
        code: "import { drizzle } from 'drizzle-orm/postgres-js';\nimport postgres from 'postgres';\n\nconst client = postgres(process.env.DATABASE_URL!, { max: 20 });\nexport const db = drizzle(client);",
        language: "typescript",
        notes:
          "Test connection limits under heavy concurrency before releasing to production.",
        gotchas:
          "Exhausting max pool connections causes downstream request timeouts.",
        dosAndDonts: [
          {
            type: "do",
            rule: "Configure connection idle timeouts",
            explanation: "Prevents stale socket leaks.",
          },
        ],
        targetRuntimes: ["Node.js 18+"],
        tags: ["database", "postgres", "drizzle"],
        status: "pending_qa",
        version: 1,
        createdBy: charlie.userId,
        updatedBy: charlie.userId,
      },
      // Private Draft in Alice's Personal Workspace
      {
        workspaceId: alicePersonal.workspaceId,
        type: "note",
        title: "Q3 Architecture Migration Strategy",
        description:
          "Draft notes covering microservice decoupling and event bus migration.",
        notes:
          "Evaluating NATS Streaming vs Apache Kafka for inter-service communication.",
        gotchas:
          "Kafka operational overhead might be excessive for current team size.",
        dosAndDonts: [],
        targetRuntimes: [],
        tags: ["architecture", "planning"],
        status: "draft",
        version: 1,
        createdBy: alice.userId,
        updatedBy: alice.userId,
      },
      // Approved Public Snippet in Public Library
      {
        workspaceId: communityPublic.workspaceId,
        type: "snippet",
        title: "Fast Python Rate Limiter using Redis Sliding Window",
        description:
          "Token bucket rate limiting pattern implemented with Redis sorted sets.",
        code: "import redis\n\ndef check_rate_limit(client: redis.Redis, key: str, limit: int, window: int) -> bool:\n    current = int(time.time())\n    pipe = client.pipeline()\n    pipe.zremrangebyscore(key, 0, current - window)\n    pipe.zcard(key)\n    pipe.zadd(key, {current: current})\n    pipe.expire(key, window)\n    _, count, _, _ = pipe.execute()\n    return count <= limit",
        language: "python",
        notes: "Requires Redis 6.2+ for optimal sorted set performance.",
        gotchas:
          "Clock skew across cluster nodes can cause slight rate limit drift.",
        dosAndDonts: [
          {
            type: "do",
            rule: "Use Redis pipelines",
            explanation: "Reduces round-trip network latency.",
          },
        ],
        targetRuntimes: ["Python 3.10+"],
        tags: ["python", "redis", "ratelimit"],
        status: "qa_approved",
        version: 2,
        verifiedBy: alice.userId,
        verifiedAt: new Date(),
        createdBy: dave.userId,
        updatedBy: dave.userId,
      },
      // Deprecated Entry
      {
        workspaceId: coreTeamPrivate.workspaceId,
        type: "snippet",
        title: "Legacy Callback-based File Reader",
        description:
          "Deprecated synchronous file reading utility replaced by fs/promises.",
        code: "import fs from 'fs';\nfunction readOld(path: string, cb: Function) { fs.readFile(path, cb); }",
        language: "typescript",
        notes: "Do not use in new code bases.",
        gotchas: "Blocks event loop if file descriptor is locked.",
        dosAndDonts: [],
        targetRuntimes: ["Node.js"],
        tags: ["legacy", "fs"],
        status: "deprecated",
        version: 3,
        verifiedBy: bob.userId,
        verifiedAt: new Date(),
        createdBy: alice.userId,
        updatedBy: alice.userId,
      },
    ])
    .returning();

  console.log(`📝 Created 5 entries across different statuses.`);

  // 7. Seed Discussion Threads & Comments with Code Suggestions
  const [thread1] = await db
    .insert(discussionThreads)
    .values([
      {
        entryId: entry1.entryId,
        title: "Should we add token expiration check?",
        body: "I noticed we verify the signature but don't explicitly check if exp claim is present.",
        status: "open",
        lineStart: 3,
        lineEnd: 5,
        snippetVersionPinned: 1,
        codeSnapshot: entry1.code,
        createdBy: bob.userId,
      },
    ])
    .returning();

  await db.insert(discussionComments).values([
    {
      threadId: thread1.threadId,
      authorId: alice.userId,
      content:
        "Good catch Bob. Here is a suggested snippet to enforce expiration validation:",
      codeBlock:
        "if (payload.exp && Date.now() >= payload.exp * 1000) {\n  throw new AppError(401, 'Token expired', 'TOKEN_EXPIRED');\n}",
      codeLanguage: "typescript",
      isSuggestion: true,
    },
    {
      threadId: thread1.threadId,
      authorId: bob.userId,
      content:
        "Looks solid! Let's merge this into the middleware update proposal.",
      isSuggestion: false,
    },
  ]);

  console.log(`💬 Created discussion thread and comments on entry 1.`);

  // 8. Seed Entry Proposals (New Entry & Update Entry with various statuses)
  await db.insert(entryProposals).values([
    // Pending Update Proposal on Entry 1
    {
      targetWorkspaceId: coreTeamPrivate.workspaceId,
      targetEntryId: entry1.entryId,
      type: "update_entry",
      entryType: "snippet",
      status: "pending",
      title: "Add Token Expiration & Role Claims Validation",
      description:
        "Proposed update to include exp check and RBAC role assertion.",
      code: entry1.code + "\n// Added expiration check",
      language: "typescript",
      notes: "Addresses security review feedback.",
      gotchas: "Requires downstream consumers to pass role claims.",
      authorId: charlie.userId,
    },
    // Draft Proposal (Private to author)
    {
      targetWorkspaceId: coreTeamPrivate.workspaceId,
      targetEntryId: entry2.entryId,
      type: "update_entry",
      entryType: "snippet",
      status: "draft",
      title: "Draft DB Pool Tuning",
      description: "Experimenting with connection keep-alive settings.",
      code: entry2.code,
      language: "typescript",
      notes: "Work in progress.",
      authorId: charlie.userId,
    },
    // Approved New Entry Proposal
    {
      targetWorkspaceId: coreTeamPrivate.workspaceId,
      type: "new_entry",
      entryType: "note",
      status: "approved",
      title: "API Versioning Guidelines",
      description: "Standard practices for URL path and header versioning.",
      notes: "Use /api/v{version}/ for all public REST endpoints.",
      authorId: bob.userId,
      reviewedBy: alice.userId,
    },
  ]);

  console.log(
    `🚀 Seed database successfully completed with comprehensive sample data!`,
  );
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
