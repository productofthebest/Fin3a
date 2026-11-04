import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Live camera QR scanner. Prefers the rear camera, stops the camera on
 * close or after a successful scan, and ignores duplicate detections of the
 * same code within a short window. The @zxing/browser import is dynamic so
 * nothing browser-only enters the SSR graph.
 */
export function QrScanner({ onScan, onClose, title = "Scan QR code" }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [fileError, setFileError] = useState("");

  async function readImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setFileError("Choose a QR image up to 10 MB.");
      return;
    }
    setReadingFile(true); setFileError("");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      onScan(result.getText());
    } catch { setFileError("No readable QR code was found in this image."); }
    finally { URL.revokeObjectURL(url); setReadingFile(false); }
  }

  useEffect(() => {
    let stopped = false;
    let controls: { stop: () => void } | null = null;

    async function start() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 300 });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
        controls = await reader.decodeFromStream(stream, videoRef.current ?? undefined, (result) => {
          if (!result || stopped) return;
          const text = result.getText();
          const now = Date.now();
          // Dedupe: ignore the same code within 3 seconds.
          if (lastScanRef.current && lastScanRef.current.text === text && now - lastScanRef.current.at < 3000) return;
          lastScanRef.current = { text, at: now };
          onScan(text);
        });
        if (!stopped) setStarting(false);
      } catch (err) {
        if (stopped) return;
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission was denied. Allow camera access in your browser settings to scan QR codes."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "Could not start the camera. Check that no other app is using it.",
        );
        setStarting(false);
      }
    }

    void start();
    return () => {
      stopped = true;
      controls?.stop();
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close scanner">
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <div className="max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
            <CameraOff className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-black">
            {starting ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-white" />
              </div>
            ) : null}
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-primary/70" />
          </div>
        )}
      </div>
      <div className="space-y-3 px-4 pb-6 text-center">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="QR image" onChange={e => { const file = e.target.files?.[0]; if (file) void readImage(file); e.target.value = ""; }} />
        <Button variant="outline" disabled={readingFile} onClick={() => fileRef.current?.click()}>{readingFile ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Choose QR image</Button>
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        <p className="text-xs text-muted-foreground">Fin3a payment or crypto address QR · No automatic payment</p>
      </div>
    </div>
  );
}
