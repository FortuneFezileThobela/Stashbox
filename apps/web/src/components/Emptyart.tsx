import React from "react";

export const EmptyArt: React.FC = () => (
  <svg className="empty-art" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
    <path d="M12 28 36 16l24 12v26L36 66 12 54z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 28l24 12 24-12M36 40v26" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity=".55" />
    <path d="M54 6v8M50 10h8M20 8v5M17.5 10.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);