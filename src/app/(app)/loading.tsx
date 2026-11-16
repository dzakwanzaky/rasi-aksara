import { Spinner } from "@/components/SubmitButton";

// Shown instantly while a page's data loads, so a tap never feels ignored (Zaky, 16 Nov 2026).
export default function Loading() {
  return (
    <div className="skel" role="status" aria-live="polite">
      <p className="skel-label"><Spinner />Memuat…</p>
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk sk-card" />
      <div className="sk sk-card" />
      <div className="sk sk-card short" />
    </div>
  );
}
