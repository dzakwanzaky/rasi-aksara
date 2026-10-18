"use client";

import { useEffect, useRef, useState } from "react";

/** Full-screen live camera. Photo proof must be taken on the spot (Zaky, 18 Okt 2026), so there is
 * no file picker: the picture comes straight from the camera stream, never from the gallery.
 * The frame is shrunk to at most 1280 px as a JPEG (~100 KB). */
export function Camera({ title, onShot, onClose }: { title: string; onShot: (photo: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setProblem("Browser ini tidak bisa membuka kamera. Coba pakai Chrome atau Safari terbaru.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
      } catch (e) {
        const name = (e as Error).name;
        setProblem(
          name === "NotAllowedError"
            ? "Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi."
            : "Kamera tidak bisa dibuka. Tutup aplikasi lain yang sedang memakai kamera, lalu coba lagi.",
        );
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((b) => { if (b) onShot(b); }, "image/jpeg", 0.7);
  }

  return (
    <div className="ck-camera" role="dialog" aria-label="Kamera">
      <p className="ck-camera-title">{title}</p>
      {problem ? (
        <p className="ck-camera-problem">{problem}</p>
      ) : (
        <video ref={video} playsInline muted onLoadedMetadata={() => setReady(true)} />
      )}
      <div className="ck-camera-bar">
        <button type="button" className="btn" onClick={onClose}>Batal</button>
        {!problem && (
          <button type="button" className="ck-shutter" aria-label="Ambil foto" disabled={!ready} onClick={shoot} />
        )}
        <span style={{ width: 70 }} />
      </div>
    </div>
  );
}
