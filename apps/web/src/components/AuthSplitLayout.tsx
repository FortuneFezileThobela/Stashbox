import React from "react";
import { Link } from "react-router-dom";

const FACTS = [
  {
    term: "Private by default",
    desc: "Workspaces are personal or team-only until you decide to make one public.",
  },
  {
    term: "Reviewed before it changes",
    desc: "Edits go to a reviewer first, and every approval bumps the entry's version.",
  },
  {
    term: "Rules next to the code",
    desc: "Each snippet carries its Do's, Don'ts and gotchas, so nobody has to ask.",
  },
];

interface AuthSplitLayoutProps {
  children: React.ReactNode;
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  children,
}) => (
  <div className="auth">
    <aside className="auth-aside">
      <div>
        <Link
          to="/welcome"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}
        >
          Back to home
        </Link>
      </div>
      <div>
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>
          <span className="brand-mark" />
          Stashbox
        </div>
        <h2>Find the snippet and the rules that come with it.</h2>
        <dl className="facts">
          {FACTS.map((f) => (
            <div key={f.term}>
              <dt>{f.term}</dt>
              <dd>{f.desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
    <main className="auth-main">{children}</main>
  </div>
);
