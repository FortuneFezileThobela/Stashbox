import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { ProposalsApi } from "../api/proposals.api";
import { EmptyArt } from "../components/Emptyart";
import { toast } from "../lib/toast";
import type { EntryProposal } from "../types/stashbox";

const TABS = [
  { id: "pending", label: "Waiting for review" },
  { id: "draft", label: "My drafts" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Declined" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Waiting for review", cls: "badge-warn" },
  draft: { label: "Private draft", cls: "badge-private" },
  approved: { label: "Approved", cls: "badge-ok" },
  rejected: { label: "Declined", cls: "badge-muted" },
  withdrawn: { label: "Withdrawn", cls: "badge-muted" },
};

const EMPTY_TEXT: Record<TabId, string> = {
  pending: "Nothing is waiting for review.",
  draft: "You have no draft suggestions.",
  approved: "No suggestions have been approved yet.",
  rejected: "No suggestions have been declined.",
};

const attempt = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
   
  }
};

const initials = (name?: string) =>
  (name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const ProposalsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const entryFilter = params.get("entry");

  const [proposals, setProposals] = useState<EntryProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>("pending");
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const workspaceId = activeWorkspace?.workspaceId;

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await ProposalsApi.listByWorkspace(workspaceId);
      setProposals(res.proposals ?? []);
    } catch {
      
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!activeWorkspace) {
    return (
      <div className="empty">
        <EmptyArt />
        <span>Pick a workspace to see its suggested edits.</span>
      </div>
    );
  }

  const role = activeWorkspace.role;
  const isReviewer = role === "owner" || role === "qa";
  const me = user?.userId;

  const scoped = entryFilter
    ? proposals.filter((p) => p.targetEntryId === entryFilter)
    : proposals;
  const filterTitle = entryFilter
    ? (scoped[0]?.originalEntry?.title ?? "this entry")
    : null;
  const counts = TABS.reduce(
    (acc, t) => ({
      ...acc,
      [t.id]: scoped.filter((p) => p.status === t.id).length,
    }),
    {} as Record<TabId, number>,
  );
  const visible = scoped.filter((p) => p.status === tab);

  const approve = (p: EntryProposal) =>
    attempt(async () => {
      let forceOverride = false;
      if (p.authorId === me) {
        if (role !== "owner") {
          toast.info(
            "You can't approve your own suggestion. Ask another reviewer.",
          );
          return;
        }
        if (
          !window.confirm(
            "You wrote this suggestion. Merge it anyway as the owner?",
          )
        )
          return;
        forceOverride = true;
      }
      await ProposalsApi.approve(p.proposalId, forceOverride);
      toast.success(
        p.type === "update_entry"
          ? "Merged. The entry has a new version."
          : "Approved. The new entry is live.",
      );
      await load();
    });

  const decline = (p: EntryProposal) =>
    attempt(async () => {
      await ProposalsApi.reject(p.proposalId, feedback.trim());
      toast.success("Suggestion declined.");
      setDecliningId(null);
      setFeedback("");
      await load();
    });

  const submitDraft = (p: EntryProposal) =>
    attempt(async () => {
      await ProposalsApi.submit(p.proposalId);
      toast.success("Sent for review.");
      setTab("pending");
      await load();
    });

  const removeDraft = (p: EntryProposal) =>
    attempt(async () => {
      if (
        !window.confirm(`Delete the draft "${p.title}"? This can't be undone.`)
      )
        return;
      await ProposalsApi.remove(p.proposalId);
      toast.success("Draft deleted.");
      await load();
    });

  const copyTo = (p: EntryProposal, destinationId: string) =>
    attempt(async () => {
      const destination = workspaces.find(
        (w) => w.workspaceId === destinationId,
      );
      await ProposalsApi.fork(p.proposalId, destinationId);
      toast.success(
        `Copied to ${destination?.name ?? "your workspace"} as a new entry.`,
      );
    });

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1>Suggested edits</h1>
        <p>
          {role === "viewer"
            ? "You're viewing a public library. You can read suggestions and copy them into your own workspaces."
            : "Review changes teammates have proposed, and keep track of your own drafts."}
        </p>
      </div>

      {filterTitle && (
        <div
          className="callout"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            Showing suggestions for <strong>{filterTitle}</strong>.
          </span>
          <button
            className="btn btn-quiet"
            onClick={() => setParams({}, { replace: true })}
          >
            Show all
          </button>
        </div>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className="tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {loading && proposals.length === 0 ? (
        <div
          aria-busy="true"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div className="skeleton" style={{ height: 96 }} />
          <div className="skeleton" style={{ height: 96 }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty" style={{ padding: "24px 0" }}>
          <EmptyArt />
          <span>{EMPTY_TEXT[tab]}</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {visible.map((p) => {
            const s = STATUS[p.status] ?? { label: p.status, cls: "" };
            const isMine = p.authorId === me;
            const authorName =
              p.author?.fullName || p.author?.username || "A teammate";
            const showCompare =
              p.type === "update_entry" &&
              p.originalEntry?.code &&
              p.code &&
              (p.status === "pending" || p.status === "draft");

            return (
              <article
                key={p.proposalId}
                className="panel"
                style={{
                  whiteSpace: "normal",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <header
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600 }}>{p.title}</h2>
                    <div className="proposal-meta">
                      {p.author?.profileUrl ? (
                        <img
                          className="mini-avatar"
                          src={p.author.profileUrl}
                          alt=""
                        />
                      ) : (
                        <span className="mini-avatar">
                          {initials(authorName)}
                        </span>
                      )}
                      <span>
                        {isMine ? "You" : authorName} suggested{" "}
                        {p.type === "update_entry"
                          ? `a change to "${p.originalEntry?.title ?? "an entry"}"`
                          : "a new entry"}{" "}
                        on {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {p.description && (
                      <p
                        style={{ color: "var(--text-secondary)", marginTop: 6 }}
                      >
                        {p.description}
                      </p>
                    )}
                  </div>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                </header>

                {showCompare ? (
                  <div className="grid-2" style={{ alignItems: "start" }}>
                    <div className="code-block">
                      <div className="code-block-head">
                        <span>
                          Current (version {p.originalEntry!.version})
                        </span>
                      </div>
                      <pre>{p.originalEntry!.code}</pre>
                    </div>
                    <div
                      className="code-block"
                      style={{ borderColor: "var(--accent-10)" }}
                    >
                      <div className="code-block-head">
                        <span>Proposed</span>
                      </div>
                      <pre>{p.code}</pre>
                    </div>
                  </div>
                ) : (
                  p.code && (
                    <div className="code-block">
                      <div className="code-block-head">
                        <span className="mono">{p.language}</span>
                      </div>
                      <pre>{p.code}</pre>
                    </div>
                  )
                )}

                {p.gotchas && (
                  <div className="callout" style={{ whiteSpace: "pre-wrap" }}>
                    <strong>Gotchas:</strong> {p.gotchas}
                  </div>
                )}

                {p.status === "rejected" && p.reviewFeedback && (
                  <div className="callout" style={{ whiteSpace: "pre-wrap" }}>
                    <strong>Reviewer feedback:</strong> {p.reviewFeedback}
                  </div>
                )}

                {decliningId === p.proposalId && (
                  <div className="form" style={{ gap: 8 }}>
                    <label className="label" htmlFor={`fb-${p.proposalId}`}>
                      Tell the author why{" "}
                      <span className="label-optional">(optional)</span>
                    </label>
                    <textarea
                      id={`fb-${p.proposalId}`}
                      rows={3}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className="actions">
                      <button
                        className="btn btn-danger"
                        onClick={() => decline(p)}
                      >
                        Decline suggestion
                      </button>
                      <button
                        className="btn btn-quiet"
                        onClick={() => {
                          setDecliningId(null);
                          setFeedback("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="actions" style={{ flexWrap: "wrap" }}>
                  {p.status === "pending" &&
                    isReviewer &&
                    decliningId !== p.proposalId && (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => approve(p)}
                        >
                          Approve and merge
                        </button>
                        <button
                          className="btn"
                          onClick={() => {
                            setDecliningId(p.proposalId);
                            setFeedback("");
                          }}
                        >
                          Decline
                        </button>
                      </>
                    )}
                  {p.status === "pending" && !isReviewer && (
                    <span className="hint" style={{ marginTop: 0 }}>
                      {isMine
                        ? "Waiting for a reviewer to look at this."
                        : "Only owners and QA reviewers can decide on this."}
                    </span>
                  )}
                  {p.status === "draft" && isMine && (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => submitDraft(p)}
                      >
                        Submit for review
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          navigate(`/proposals/${p.proposalId}/edit`)
                        }
                      >
                        Edit draft
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => removeDraft(p)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {p.status !== "draft" && workspaces.length > 0 && (
                    <select
                      aria-label="Copy this suggestion to one of your workspaces"
                      style={{ width: "auto" }}
                      value=""
                      onChange={(e) =>
                        e.target.value && copyTo(p, e.target.value)
                      }
                    >
                      <option value="" disabled>
                        Copy to my workspace…
                      </option>
                      {workspaces.map((w) => (
                        <option key={w.workspaceId} value={w.workspaceId}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
