# Stashbox: Engineering Pattern & Snippet Repository
### A Reference Architecture for Collaborative Knowledge, Access Governance, and Code Review Workflows

> **Scope Note:** This showcase presents the **Web + API** platform in full working form.
> **Future Scope** Create a VS Cide extension companion that can allow access of snippets inside the editor.
---

## Chapter 1: System Overview & Problem Statement

Engineering teams accumulate high-value code fragments, operational runbooks, and architectural notes across chat logs, wikis, and local scratchpads. Without structure, these artifacts become stale, unverified, or difficult to discover.

**Stashbox** models technical knowledge as versioned, governed **entries** (snippets and notes) organized inside **workspaces**, supported by **change proposals** and **version-pinned discussion threads**.

### Core Design Goals
1. **Context-Appropriate Governance:** Individual experimentation should move fast; shared team knowledge should pass review.
2. **Strict Visibility Boundaries:** Work-in-progress drafts remain private to their author, while public libraries expose only approved artifacts to non-members.
3. **Traceable Change & Review:** Modifications to governed entries flow through explicit proposals and four-eyes verification rather than silent overwrites.

---

## Chapter 2: Domain Model & Core Subsystems

The platform is organized as a TypeScript monorepo:

- `apps/api` — Node.js, TypeScript, and Express REST API implementing domain services, validation, and authorization rules.
- `packages/db` — PostgreSQL schema definitions and migrations via **Drizzle ORM**, plus a deterministic seeding script.
- `apps/web` — TypeScript web client providing workspace browsing, entry authoring, proposal workflows, and discussion views.

### 2.1 Workspaces & Membership Roles
Workspaces partition entries and define governance behavior:
- **Workspace Types:**
  - *Personal Workspaces:* Optimized for solo velocity—entries and forks auto-approve immediately.
  - *Team Workspaces:* Designed for shared standards—entries and updates enter review or proposal workflows.
- **Visibility Modes:**
  - *Private Workspaces:* Restricted to workspace members.
  - *Public Workspaces:* Discoverable for read-only viewing of `qa_approved` entries by non-members.
- **Roles:** `owner`, `qa`, and `member` (with last-owner protection so a workspace cannot be orphaned).

### 2.2 Entry Lifecycle & Draft Privacy
Entries represent reusable code snippets or engineering notes carrying metadata such as language, target runtimes, tags, gotchas, and do/don't rules.

- **Statuses:** `draft`, `pending_qa`, `qa_approved`, and `deprecated`.
- **Draft Isolation:** Entries in `draft` status are visible only to their creator (`createdBy === userId`). Non-authors and non-members cannot read or enumerate another user's drafts.
- **Public Read-Only Mode:** Non-members viewing a public workspace can inspect only `qa_approved` entries.

### 2.3 Proposals & Four-Eyes Verification
In governed team workflows, changes to existing entries—or new contributions depending on workflow—can be captured as **proposals** (`draft`, `pending`, `approved`, `rejected`):
- Authors can refine `draft` proposals before submitting them to `pending`.
- Reviewers (`qa` or `owner`) can approve or reject pending proposals, with optional review feedback.
- **Four-Eyes Principle:** Approval enforces `verifiedBy !== createdBy` so authors do not rubber-stamp their own work, while allowing an explicit `forceOverride` path for a workspace `owner` when operationally justified.
- Approving a proposal increments entry versioning (`version + 1`) or materializes a new `qa_approved` entry inside a database transaction; entries and proposals can also be **forked** into target workspaces while preserving lineage (`forkedFromId`, `forkedFromVersion`).

### 2.4 Line-Anchored Discussion Threads
Code review conversations are anchored directly to an entry and optional line range (`lineStart` to `lineEnd`), capturing a code snapshot and pinned snippet version (`snippetVersionPinned`). Participants can post comments, attach structured **code suggestions** (`isSuggestion`, `codeBlock`, `codeLanguage`), and transition threads across `open`, `resolved`, and `closed` states.

---

## Chapter 3: Lab Exercise — Bootstrapping the Local Environment

### Prerequisites
- Docker and Docker Compose
- Node.js / npm (for local tooling or inspection)

### Step-by-Step Procedure

1. **Build and start the containerized stack (`db`, `api`, `web`):**
   ```bash
   docker compose up --build -d
