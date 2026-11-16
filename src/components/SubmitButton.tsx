"use client";

import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Which button sent each form, so only that one shows the spinner (a form can have Simpan and Hapus).
const submitters = new WeakMap<HTMLFormElement, Element | null>();
if (typeof document !== "undefined") {
  document.addEventListener("submit", (e) => submitters.set(e.target as HTMLFormElement, (e as SubmitEvent).submitter), true);
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: ReactNode };

/**
 * A submit button for a server action form. While the action runs every button in the form is
 * disabled (no double submit) and the one that was pressed shows a spinner and pendingText.
 */
export function SubmitButton({ children, pendingText = "Menyimpan…", className = "btn", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const form = ref.current?.form;
  const by = form ? submitters.get(form) : undefined;
  const mine = pending && (!by || by === ref.current);
  return (
    <button ref={ref} {...rest} className={className} disabled={pending || disabled} aria-busy={mine || undefined}>
      {mine ? <><Spinner />{pendingText}</> : children}
    </button>
  );
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />;
}
