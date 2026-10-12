"use client";

import { useState } from "react";

/** Copies the purchase list as plain text, ready to paste into WhatsApp. */
export function CopyList({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn primary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Tersalin" : "Salin untuk WhatsApp"}
    </button>
  );
}
