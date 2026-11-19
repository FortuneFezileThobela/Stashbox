import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { EntriesApi } from "../api/entries.api";
import { ProposalsApi } from "../api/proposals.api";
import { toast } from "../lib/toast";
import type { DoAndDontRule, Entry, EntryType } from "../types/stashbox";

type Mode = "create" | "edit" | "propose" | "edit-proposal";

interface EntryEditorPageProps {
  mode: Mode;
}

interface Flow {
  heading: string;
  hint: string;
  draftLabel?: string;
  submitLabel: string;
}

const splitList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const EntryEditorPage: React.FC<EntryEditorPageProps> = ({ mode }) => {
  const { entryId, proposalId } = useParams<{
    entryId: string;
    proposalId: string;
  }>();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const [type, setType] = useState<EntryType>("snippet");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [gotchas, setGotchas] = useState("");
  const [runtimes, setRuntimes] = useState("Node 20");
  const [tags, setTags] = useState("");
  const [rules, setRules] = useState<DoAndDontRule[]>([]);
  const [loadedEntry, setLoadedEntry] = useState<Entry | null>(null);
  const [ready, setReady] = useState(mode === "create");
  const [saving, setSaving] = useState(false);

  const role = activeWorkspace?.role;
  const isViewer = role === "viewer";
  const isReviewer = role === "owner" || role === "qa";
  const isPersonal = activeWorkspace?.type === "personal";
  const isOwnDraft = Boolean(
    loadedEntry &&
    loadedEntry.status === "draft" &&
    loadedEntry.createdBy === user?.userId,
  );
  const canEditDirectly =
    isOwnDraft || (!isViewer && (isPersonal || isReviewer));

  // Anyone who can't edit directly gets the "suggest an edit" flow instead
  const effective: Mode =
    mode === "edit" && loadedEntry && !canEditDirectly ? "propose" : mode;

  const fill = (src: {
    entryType?: EntryType;
    type?: EntryType;
    title: string;
    description?: string | null;
    language?: string | null;
    code?: string | null;
    notes?: string | null;
    gotchas?: string | null;
    targetRuntimes?: string[];
    tags?: string[];
    dosAndDonts?: DoAndDontRule[];
  }) => {
    setType(src.entryType ?? src.type ?? "snippet");
    setTitle(src.title);
    setDescription(src.description || "");
    setLanguage(src.language || "typescript");
    setCode(src.code || "");
    setNotes(src.notes || "");
    setGotchas(src.gotchas || "");
    setRuntimes((src.targetRuntimes || []).join(", "));
    setTags((src.tags || []).join(", "));
    setRules(src.dosAndDonts || []);
  };

  useEffect(() => {
    if ((mode === "edit" || mode === "propose") && entryId) {
      EntriesApi.getById(entryId)
        .then((entry) => {
          fill(entry);
          setLoadedEntry(entry);
          setReady(true);
        })
        .catch(() => navigate("/", { replace: true }));
    } else if (mode === "edit-proposal" && proposalId) {
      ProposalsApi.getById(proposalId)
        .then((p) => {
          if (p.status !== "draft") {
            toast.info("Only draft suggestions can be edited.");
            navigate("/proposals", { replace: true });
            return;
          }
          // A proposal's own `type` means new-vs-update, so only its entryType is used here
          fill({ ...p, type: undefined });
          setReady(true);
        })
        .catch(() => navigate("/proposals", { replace: true }));
    }
 
  }, [mode, entryId, proposalId]);

  const updateRule = (i: number, patch: Partial<DoAndDontRule>) =>
    setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) =>
    setRules((rs) => rs.filter((_, idx) => idx !== i));
  const addRule = (kind: "do" | "dont") =>
    setRules((rs) => [...rs, { type: kind, rule: "", explanation: "" }]);

  const publishLabel = isPersonal ? "Publish" : "Submit for review";
  const flows: Record<Mode, Flow> = {
    create: {
      heading: "New entry",
      hint: `Save a draft only you can see, or ${isPersonal ? "publish it right away" : "send it to a reviewer"}.`,
      draftLabel: "Save as draft",
      submitLabel: publishLabel,
    },
    edit: isOwnDraft
      ? {
          heading: "Edit draft",
          hint: "Drafts are private to you until you submit them.",
          draftLabel: "Save draft",
          submitLabel: publishLabel,
        }
      : {
          heading: "Edit entry",
          hint: isPersonal
            ? "Saving updates the entry and bumps its version."
            : "Your change is recorded in suggested edits and merged right away.",
          submitLabel: "Save changes",
        },
    propose: {
      heading: "Suggest an edit",
      hint: "A reviewer will look at your changes. The entry stays as it is until they approve.",
      draftLabel: "Save as draft",
      submitLabel: "Submit suggestion",
    },
    "edit-proposal": {
      heading: "Edit draft suggestion",
      hint: "Drafts are private to you until you submit them for review.",
      draftLabel: "Save draft",
      submitLabel: "Submit for review",
    },
  };
  const flow = flows[effective];

  const save = async (asDraft: boolean) => {
    if (!activeWorkspace) return;
    if (!title.trim()) {
      toast.info("Give it a title first.");
      return;
    }
    setSaving(true);

    const isSnippet = type === "snippet";
    const payload = {
      title,
      description,
      language: isSnippet ? language : undefined,
      code: isSnippet ? code : undefined,
      notes,
      gotchas: gotchas || undefined,
      targetRuntimes: splitList(runtimes),
      dosAndDonts: rules.filter((r) => r.rule.trim()),
    };
    const targetWorkspaceId =
      loadedEntry?.workspaceId ?? activeWorkspace.workspaceId;

    try {
      if (effective === "create") {
        await EntriesApi.create({
          ...payload,
          workspaceId: activeWorkspace.workspaceId,
          type,
          tags: splitList(tags),
          saveAsDraft: asDraft,
        });
        toast.success(
          asDraft
            ? "Draft saved. Only you can see it."
            : isPersonal
              ? "Published. Your entry is live."
              : "Sent for review.",
        );
        navigate("/");
      } else if (effective === "edit" && entryId) {
        const res = await EntriesApi.update(entryId, {
          ...payload,
          tags: splitList(tags),
          saveAsDraft: isOwnDraft ? asDraft : undefined,
        });
        toast.success(
          res.outcome === "proposed"
            ? "Suggestion sent for review."
            : res.outcome === "merged"
              ? "Saved. The change is recorded in suggested edits."
              : isOwnDraft && asDraft
                ? "Draft saved."
                : "Changes saved.",
        );
        navigate("/");
      } else if (effective === "propose" && entryId) {
        await ProposalsApi.create({
          ...payload,
          targetWorkspaceId,
          targetEntryId: entryId,
          entryType: type,
          status: asDraft ? "draft" : "pending",
        });
        toast.success(
          asDraft
            ? "Draft saved. Only you can see it."
            : "Suggestion sent for review.",
        );
        navigate(asDraft ? "/proposals" : `/proposals?entry=${entryId}`);
      } else if (effective === "edit-proposal" && proposalId) {
        await ProposalsApi.update(proposalId, payload);
        if (!asDraft) await ProposalsApi.submit(proposalId);
        toast.success(asDraft ? "Draft saved." : "Sent for review.");
        navigate("/proposals");
      }
    } catch {
      /* the error toast is shown globally */
    } finally {
      setSaving(false);
    }
  };

  if (mode === "create" && (!activeWorkspace || isViewer)) {
    return (
      <div className="page">
        <div className="panel" style={{ whiteSpace: "normal" }}>
          <strong>
            {isViewer
              ? "Public libraries are read-only."
              : "You need a workspace first."}
          </strong>
          <p className="hint" style={{ marginBottom: 12 }}>
            {isViewer
              ? "Switch to one of your own workspaces to create entries, or fork an entry from this library."
              : "Create a workspace to start saving entries."}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(isViewer ? "/" : "/workspace-settings")}
          >
            {isViewer ? "Back to the library" : "Create a workspace"}
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="page" aria-busy="true">
        <div className="skeleton" style={{ height: 28, width: "40%" }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <form
      className="page"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      <div className="page-head">
        <h1>{flow.heading}</h1>
        <p>{flow.hint}</p>
      </div>

      <section className="form-section">
        {effective === "create" && (
          <div
            className="segmented"
            role="group"
            aria-label="Entry type"
            style={{ alignSelf: "flex-start" }}
          >
            <button
              type="button"
              aria-pressed={type === "snippet"}
              onClick={() => setType("snippet")}
            >
              Code snippet
            </button>
            <button
              type="button"
              aria-pressed={type === "note"}
              onClick={() => setType("note")}
            >
              Technical note
            </button>
          </div>
        )}

        <div
          className={type === "snippet" ? "grid-2" : undefined}
          style={
            type === "snippet" ? { gridTemplateColumns: "2fr 1fr" } : undefined
          }
        >
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          {type === "snippet" && (
            <div>
              <label className="label" htmlFor="language">
                Language
              </label>
              <input
                id="language"
                className="mono"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="summary">
            Summary <span className="label-optional">(optional)</span>
          </label>
          <input
            id="summary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One line on what this is for"
          />
        </div>
      </section>

      {type === "snippet" && (
        <section className="form-section">
          <h2>Code</h2>
          <textarea
            className="mono"
            aria-label="Code"
            rows={14}
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ lineHeight: 1.6, resize: "vertical" }}
          />
        </section>
      )}

      <section className="form-section">
        <div>
          <h2>Usage rules</h2>
          <p className="hint">
            Spell out what to do and what to avoid. Empty rules are ignored when
            you save.
          </p>
        </div>
        <div className="grid-2" style={{ alignItems: "start" }}>
          {(["do", "dont"] as const).map((kind) => (
            <div key={kind} className="rule-list">
              <span className="label" style={{ marginBottom: 0 }}>
                {kind === "do" ? "Do" : "Don't"}
              </span>
              {rules.map(
                (r, i) =>
                  r.type === kind && (
                    <div key={i} className={`rule-edit rule-${kind}`}>
                      <input
                        aria-label={`${kind === "do" ? "Do" : "Don't"} rule`}
                        value={r.rule}
                        placeholder={
                          kind === "do"
                            ? "Add jitter to retries"
                            : "Retry non-idempotent calls"
                        }
                        onChange={(e) =>
                          updateRule(i, { rule: e.target.value })
                        }
                      />
                      <input
                        aria-label="Why"
                        value={r.explanation}
                        placeholder="Why it matters"
                        onChange={(e) =>
                          updateRule(i, { explanation: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-quiet"
                        style={{ justifySelf: "end" }}
                        onClick={() => removeRule(i)}
                      >
                        Remove
                      </button>
                    </div>
                  ),
              )}
              <button
                type="button"
                className="btn"
                style={{ alignSelf: "flex-start" }}
                onClick={() => addRule(kind)}
              >
                {kind === "do" ? "Add a do" : "Add a don't"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Notes and caveats</h2>
        <div className="grid-2">
          <div>
            <label className="label" htmlFor="notes">
              Implementation notes
            </label>
            <textarea
              id="notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="gotchas">
              Gotchas
            </label>
            <textarea
              id="gotchas"
              rows={5}
              value={gotchas}
              onChange={(e) => setGotchas(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Where it runs</h2>
        <div className="grid-2">
          <div>
            <label className="label" htmlFor="runtimes">
              Runtimes
            </label>
            <input
              id="runtimes"
              value={runtimes}
              onChange={(e) => setRuntimes(e.target.value)}
              placeholder="Node 20, PostgreSQL 16"
            />
            <p className="hint">Separate with commas.</p>
          </div>
          {(effective === "create" || effective === "edit") && (
            <div>
              <label className="label" htmlFor="tags">
                Tags
              </label>
              <input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="http, resilience"
              />
              <p className="hint">Separate with commas.</p>
            </div>
          )}
        </div>
      </section>

      <div className="sticky-actions">
        <button type="button" className="btn" onClick={() => navigate(-1)}>
          Cancel
        </button>
        {flow.draftLabel && (
          <button
            type="button"
            className="btn"
            disabled={saving}
            onClick={() => save(true)}
          >
            {flow.draftLabel}
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : flow.submitLabel}
        </button>
      </div>
    </form>
  );
};
