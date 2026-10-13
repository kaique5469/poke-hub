/**
 * Camera helpers for the scanner: open the rear camera, measure how still
 * the frame is (so capture can be automatic), and crop the viewfinder area
 * into a JPEG small enough for the identify endpoint (≤ 3 MB, ≥ 8 KB).
 *
 * No OpenCV: a frame-difference stillness test on a 32×32 thumbnail is
 * enough to know when the person is holding the phone steady over a card,
 * and it costs nothing on a low-end Android.
 */

export type CameraStatus =
  | "idle"
  | "starting"
  | "ready"
  | "denied"
  | "unavailable";

export async function openRearCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("unavailable");
  }
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const name = (error as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new Error("denied");
    }
    // Some devices reject the facingMode constraint; retry with anything.
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true });
    } catch {
      throw new Error("unavailable");
    }
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

/** Mean absolute luma difference between two 32×32 thumbnails (0–255). */
export class StillnessMeter {
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null;
  private previous: Uint8ClampedArray | null = null;
  private steadyFrames = 0;

  constructor(private size = 32) {
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  /**
   * Returns the motion score for this frame and whether the frame has been
   * steady long enough to capture. `threshold` is in luma units (≈4 works
   * for handheld phones); `requiredFrames` ≈ 0.6 s at 10 fps sampling.
   */
  sample(
    video: HTMLVideoElement,
    threshold = 4,
    requiredFrames = 6
  ): { motion: number; steady: boolean } {
    if (!this.ctx || video.readyState < 2) return { motion: 255, steady: false };
    this.ctx.drawImage(video, 0, 0, this.size, this.size);
    const { data } = this.ctx.getImageData(0, 0, this.size, this.size);
    const luma = new Uint8ClampedArray(this.size * this.size);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      luma[j] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    }
    let motion = 255;
    if (this.previous) {
      let sum = 0;
      for (let i = 0; i < luma.length; i++) {
        sum += Math.abs(luma[i] - this.previous[i]);
      }
      motion = sum / luma.length;
    }
    this.previous = luma;
    this.steadyFrames = motion < threshold ? this.steadyFrames + 1 : 0;
    return { motion, steady: this.steadyFrames >= requiredFrames };
  }

  reset() {
    this.previous = null;
    this.steadyFrames = 0;
  }
}

/**
 * Crops the region of the video that sits under the viewfinder box and
 * returns a JPEG blob. `frame` is the viewfinder's bounding box relative to
 * the video element's box (both in CSS pixels, as laid out with
 * object-fit: cover).
 */
export async function captureViewfinder(
  video: HTMLVideoElement,
  videoBox: DOMRect,
  frame: DOMRect,
  maxEdge = 1400
): Promise<Blob> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Camera not ready");

  // object-fit: cover → the video is scaled by max(boxW/vw, boxH/vh) and
  // centred; compute the source rect that the frame box corresponds to.
  const scale = Math.max(videoBox.width / vw, videoBox.height / vh);
  const shownW = vw * scale;
  const shownH = vh * scale;
  const offsetX = (videoBox.width - shownW) / 2;
  const offsetY = (videoBox.height - shownH) / 2;

  const pad = 0.06; // keep a little context around the card for the model
  const fx = frame.left - videoBox.left - frame.width * pad;
  const fy = frame.top - videoBox.top - frame.height * pad;
  const fw = frame.width * (1 + pad * 2);
  const fh = frame.height * (1 + pad * 2);

  const sx = Math.max(0, (fx - offsetX) / scale);
  const sy = Math.max(0, (fy - offsetY) / scale);
  const sw = Math.min(vw - sx, fw / scale);
  const sh = Math.min(vh - sy, fh / scale);

  const outScale = Math.min(1, maxEdge / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * outScale));
  canvas.height = Math.max(1, Math.round(sh * outScale));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvasToJpeg(canvas);
}

export async function fileToJpeg(file: File, maxEdge = 1800): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 12_000_000) throw new Error("Photo must be smaller than 12 MB.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  const source: HTMLImageElement | ImageBitmap = bitmap ?? (await loadImage(file));
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return canvasToJpeg(canvas);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this photo."));
    };
    img.src = url;
  });
}

async function canvasToJpeg(canvas: HTMLCanvasElement) {
  const make = (q: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("JPEG failed"))), "image/jpeg", q)
    );
  let blob = await make(0.86);
  if (blob.size > 2_800_000) blob = await make(0.72);
  if (blob.size > 3_000_000) throw new Error("Photo is still too large.");
  if (blob.size < 8_000) {
    // Tiny crops happen when the frame fell outside the video; upscale once.
    const bigger = document.createElement("canvas");
    bigger.width = canvas.width * 2;
    bigger.height = canvas.height * 2;
    bigger.getContext("2d")?.drawImage(canvas, 0, 0, bigger.width, bigger.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      bigger.toBlob(b => (b ? resolve(b) : reject(new Error("JPEG failed"))), "image/jpeg", 0.92)
    );
  }
  return blob;
}
