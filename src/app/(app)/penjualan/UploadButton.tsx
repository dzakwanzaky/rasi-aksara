"use client";

import { useFormStatus } from "react-dom";

export function UploadButton() {
  const { pending } = useFormStatus();
  return <button className="btn primary" disabled={pending}>{pending ? "Membaca file…" : "Upload & hitung"}</button>;
}
