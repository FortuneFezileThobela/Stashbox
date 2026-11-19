import React from "react";
import { useNavigate } from "react-router-dom";

const SAMPLE_CODE = `async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries - 1) throw err;
      const wait = 2 ** i * 200 + Math.random() * 100;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}`;

const STEPS = [
  {
    title: "Write it down",
    text: "Save a snippet or note, along with the runtimes it targets.",
  },
  {
    title: "Attach the rules",
    text: "Add Do's, Don'ts and gotchas right next to the code.",
  },
  {
    title: "Get it reviewed",
    text: "A QA reviewer approves or declines every suggested change.",
  },
  {
    title: "Use it everywhere",
    text: "Approved entries bump their version and reach your team and your editor.",
  },
];

const FEATURES = [
  {
    title: "Private or shared workspaces",
    text: "Keep a personal library, run a team library, or fork a whole workspace to make it your own.",
  },
  {
    title: "Roles that match how you review",
    text: "Owners manage members, QA reviewers approve changes, and members suggest edits.",
  },
  {
    title: "Suggested edits, not overwrites",
    text: "Anyone can propose a change. The original stays untouched until a reviewer merges it.",
  },
  {
    title: "Access from your editor",
    text: "Create personal access tokens for VS Code and the command line. Revoke them any time.",
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="container">
        <header className="site-head">
          <div className="brand" style={{ padding: 0 }}>
            <span className="brand-mark" />
            Stashbox
          </div>
          <div className="actions">
            <button className="btn" onClick={() => navigate("/login")}>
              Sign in
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/register")}
            >
              Create account
            </button>
          </div>
        </header>

        <section className="hero">
          <div>
            <h1>Stop losing production patterns in chat threads.</h1>
            <p className="lede">
              Stashbox is a private place for your team to keep reusable
              snippets, with the rules and gotchas attached and a reviewer's
              sign-off before anything changes.
            </p>
            <div className="cta-row">
              <button
                className="btn btn-primary btn-lg"
                onClick={() => navigate("/register")}
              >
                Create a free account
              </button>
              <button className="btn btn-lg" onClick={() => navigate("/login")}>
                Sign in
              </button>
            </div>
          </div>

          {/* A sample entry, so visitors see the product instead of reading about it */}
          <div className="sample" aria-label="Example of a Stashbox entry">
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span className="badge badge-ok">Verified</span>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--text-secondary)" }}
                >
                  Version 4
                </span>
              </div>
              <strong style={{ fontSize: 17 }}>
                Retry with exponential backoff
              </strong>
            </div>
            <div className="code-block">
              <div className="code-block-head">
                <span className="mono">typescript</span>
              </div>
              <pre>
                {SAMPLE_CODE.split("\n").map((line, i) => (
                  <span
                    key={i}
                    className="line"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    {line || " "}
                  </span>
                ))}
              </pre>
            </div>
            <div className="rules">
              <div className="rule rule-do">
                <strong>Do: add jitter</strong>
                <p>Spreads retries so clients don't stampede.</p>
              </div>
              <div className="rule rule-dont">
                <strong>Don't: retry POSTs blindly</strong>
                <p>Only retry calls that are idempotent.</p>
              </div>
            </div>
            <div className="callout">
              <strong>Gotcha:</strong> Node 20's built-in fetch doesn't retry on
              its own.
            </div>
          </div>
        </section>

        <section className="band">
          <h2>How an entry earns its Verified badge</h2>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.title}>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="band">
          <h2>Built for teams that review their code</h2>
          <div className="features">
            {FEATURES.map((f) => (
              <div className="feature" key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="band"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <h2>Give your team one place to look first.</h2>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate("/register")}
          >
            Create a free account
          </button>
        </section>
      </div>
    </div>
  );
};
