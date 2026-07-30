/**
 * Screen capture and recording.
 *
 * A cross-origin iframe cannot be rasterised by page JavaScript — the same-origin
 * policy forbids reading its pixels, and there is no web API that returns them.
 * The only standards-compliant way to capture what the user sees is the Screen
 * Capture API, which requires an explicit user permission prompt and is not
 * available on iOS Safari or most Android browsers.
 */

export const canCaptureDisplay = (): boolean =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getDisplayMedia === "function";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke on the next task so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Grab a single frame of the shared surface and download it as a PNG. */
export async function captureScreenshot(): Promise<void> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  try {
    const track = stream.getVideoTracks()[0];
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const settings = track.getSettings();
    const canvas = document.createElement("canvas");
    canvas.width = settings.width ?? video.videoWidth;
    canvas.height = settings.height ?? video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    video.pause();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Screenshot encoding failed");
    download(blob, `desktop-view-${Date.now()}.png`);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export interface RecordingHandle {
  stop: () => void;
}

/** Record the shared surface to a WebM file. */
export async function startRecording(onStop: () => void): Promise<RecordingHandle> {
  if (typeof MediaRecorder === "undefined") throw new Error("MediaRecorder is not supported here");
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (chunks.length) download(new Blob(chunks, { type: mime ?? "video/webm" }), `desktop-view-${Date.now()}.webm`);
    onStop();
  };
  stream.getVideoTracks()[0].addEventListener("ended", () => recorder.state !== "inactive" && recorder.stop());
  recorder.start();

  return { stop: () => recorder.state !== "inactive" && recorder.stop() };
}
