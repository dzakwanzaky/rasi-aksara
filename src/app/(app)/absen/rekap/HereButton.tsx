"use client";

import { useState } from "react";
import { readLocation } from "../AbsenFlow";

/** Fills the location box with where this phone is now, for an admin standing in the cafe. */
export function HereButton({ target }: { target: string }) {
  const [state, setState] = useState("");
  async function fill() {
    setState("Membaca lokasi…");
    try {
      const fix = await readLocation();
      const input = document.getElementById(target) as HTMLInputElement | null;
      if (input) input.value = `${fix.lat.toFixed(6)}, ${fix.lng.toFixed(6)}`;
      setState(`Terbaca (±${Math.round(fix.accuracy)} m). Tekan Simpan lokasi.`);
    } catch (e) {
      setState((e as Error).message);
    }
  }
  return (
    <>
      <button type="button" className="btn" onClick={fill}>📍 Pakai lokasi HP ini</button>
      {state && <span className="muted small">{state}</span>}
    </>
  );
}
