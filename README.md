# Stashbox: Engineering Pattern & Snippet Repository
### A Reference Architecture for Collaborative Knowledge, Access Governance, and Code Review Workflows

> **Scope Note:** This showcase presents the **Web + API** platform in full working form.
> **Future Scope:** Create a VS Code extension companion to access snippets directly inside the editor.

---

## Chapter 1: System Overview

Stashbox is a place to store, review, and share code snippets and technical notes across personal and team workspaces.

- **Workspaces:** Keep private or personal notes, or run shared team libraries with public read-only access to approved items.
- **Review & Proposals:** Track changes through proposals and approvals instead of overwriting shared snippets blindly.
- **Discussions:** Talk through specific parts of a snippet and suggest improvements in context.

---

## Chapter 2: High-Level Architecture

Stashbox is split into three main parts:

- `apps/api` — Backend API handling workspaces, entries, proposals, and discussions.
- `packages/db` — Database schema, migrations, and seed data.
- `apps/web` — Web interface for browsing, authoring, and reviewing.

---

## Chapter 3: Getting Started Locally

1. Start the stack:
   ```bash
   docker compose up --build -d
