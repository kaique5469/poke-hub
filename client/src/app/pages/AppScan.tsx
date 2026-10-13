import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Zap, ZapOff } from "lucide-react";
import { toast } from "sonner";
import { useT } from "../i18n";
import { track } from "../analytics";
import { SignInCard } from "../components/SignInCard";
import {
  StillnessMeter,
  captureViewfinder,
  fileToJpeg,
  openRearCamera,
  stopStream,
  type CameraStatus,
} from "../scanner/camera";
import { identifyCard, ScanError, type ScanResult } from "../scanner/identify";
import { ReviewSheet, defaultDraft, type ReviewDraft } from "../scanner/ReviewSheet";
import { APP_STORAGE_KEYS } from "@shared/app";

type QueueItem = {
  id: string;
  previewUrl: string;
  status: "identifying" | "ready" | "failed" | "collected";
  result?: ScanResult;
  draft?: ReviewDraft | null;
  error?: string;
};

const AUTO_COOLDOWN_MS = 2_500;
const SAMPLE_INTERVAL_MS = 100;

function rememberRecentScan(result: ScanResult) {
  const best = result.matches[0];
  if (!best) return;
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEYS.recentScans);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    const entry = {
      id: best.id,
      name: best.name,
      setName: best.set.name,
      number: best.number,
      imageUrl: best.images.small,
      priceUsd: best.suggestedPriceUsd ?? best.marketPriceUsd,
      at: new Date().toISOString(),
    };
    localStorage.setItem(
      APP_STORAGE_KEYS.recentScans,
      JSON.stringify([entry, ...list].slice(0, 12))
    );
  } catch {
    // ignore
  }
}

export default function AppScan() {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<StillnessMeter | null>(null);
  const inFlight = useRef(false);
  const lastAutoAt = useRef(0);
  const needsMotion = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [camera, setCamera] = useState<CameraStatus>("idle");
  const [auto, setAuto] = useState(true);
  const [steady, setSteady] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [quota, setQuota] = useState<ScanResult["quota"] | null>(null);
  const [limitHit, setLimitHit] = useState<"anonymous" | "daily" | null>(null);

  const busy = queue.some(q => q.status === "identifying");

  const updateItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue(q => q.map(item => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const runIdentify = useCallback(
    async (id: string, blob: Blob) => {
      inFlight.current = true;
      track("scan_started", { auto });
      try {
        const result = await identifyCard(blob);
        setQuota(result.quota);
        if (!result.analysis.isPokemonCard || result.matches.length === 0) {
          updateItem(id, {
            status: "failed",
            error: t("Could not identify this card. Try better light or search by name."),
          });
          track("scan_failed", { reason: "no_match" });
          return;
        }
        rememberRecentScan(result);
        updateItem(id, { status: "ready", result, draft: defaultDraft(result) });
        track("scan_success", {
          score: result.matches[0].matchScore,
          confidence: result.analysis.confidence,
        });
        setReviewId(current => current ?? id);
      } catch (error) {
        const scanError = error instanceof ScanError ? error : null;
        const message =
          scanError?.code === "rate_limited"
            ? t("Too many scans at once. Wait a minute.")
            : scanError?.code === "anonymous_limit"
              ? t("Daily scan limit reached. Create a free account for a bigger daily budget.")
              : scanError?.code === "daily_limit"
                ? t("Daily scan limit reached. Try again tomorrow.")
                : scanError?.code === "unavailable"
                  ? t("The scanner is unavailable right now.")
                  : t("Could not identify this card. Try better light or search by name.");
        if (scanError?.code === "anonymous_limit") setLimitHit("anonymous");
        if (scanError?.code === "daily_limit") setLimitHit("daily");
        updateItem(id, { status: "failed", error: message });
        track("scan_failed", { reason: scanError?.code ?? "unknown" });
        toast.error(message);
      } finally {
        inFlight.current = false;
      }
    },
    [auto, t, updateItem]
  );

  const enqueue = useCallback(
    (blob: Blob) => {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const previewUrl = URL.createObjectURL(blob);
      setQueue(q => [...q, { id, previewUrl, status: "identifying" }]);
      void runIdentify(id, blob);
    },
    [runIdentify]
  );

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || inFlight.current) return;
    try {
      const blob = await captureViewfinder(
        video,
        video.getBoundingClientRect(),
        frame.getBoundingClientRect()
      );
      lastAutoAt.current = Date.now();
      needsMotion.current = true;
      if (navigator.vibrate) navigator.vibrate(12);
      enqueue(blob);
    } catch {
      toast.error(t("Camera unavailable"));
    }
  }, [enqueue, t]);

  // Open the camera; close it when leaving the page.
  useEffect(() => {
    let cancelled = false;
    setCamera("starting");
    openRearCamera()
      .then(stream => {
        if (cancelled) return stopStream(stream);
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => undefined);
        }
        meterRef.current = new StillnessMeter();
        setCamera("ready");
      })
      .catch(error => {
        if (cancelled) return;
        setCamera(error?.message === "denied" ? "denied" : "unavailable");
      });
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  // Stillness sampling → auto capture.
  useEffect(() => {
    if (camera !== "ready") return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const meter = meterRef.current;
      if (!video || !meter) return;
      const { motion, steady: isSteady } = meter.sample(video);
      if (needsMotion.current && motion > 10) needsMotion.current = false;
      setSteady(isSteady && !needsMotion.current);
      if (
        auto &&
        isSteady &&
        !needsMotion.current &&
        !inFlight.current &&
        !limitHit &&
        Date.now() - lastAutoAt.current > AUTO_COOLDOWN_MS
      ) {
        meter.reset();
        void capture();
      }
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [auto, camera, capture, limitHit]);

  // Release preview URLs on unmount.
  useEffect(
    () => () => {
      queue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      enqueue(await fileToJpeg(file));
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const reviewItem = queue.find(q => q.id === reviewId) ?? null;
  const readyCount = queue.filter(q => q.status === "ready").length;

  const viewfinderState = busy ? "busy" : steady ? "steady" : "idle";

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-black">
      {/* Camera */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          aria-label={t("Scan a card")}
        />
        {camera === "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              ref={frameRef}
              className="app-viewfinder"
              data-state={viewfinderState}
              aria-hidden
            />
            <p className="mt-5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-medium text-white">
              {busy
                ? t("Identifying…")
                : steady && auto
                  ? t("Hold still…")
                  : t("Fit the card inside the frame")}
            </p>
          </div>
        )}
        {(camera === "denied" || camera === "unavailable") && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="app-dark rounded-2xl border border-border bg-card p-5 text-center">
              <h2 className="text-lg font-bold">{t("Camera unavailable")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("Allow camera access to scan cards, or pick a photo from your gallery.")}
              </p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground"
              >
                {t("Choose photo")}
              </button>
            </div>
          </div>
        )}

        {/* Top controls */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 pt-[calc(var(--app-safe-top)+12px)]">
          <button
            type="button"
            onClick={() => setAuto(a => !a)}
            aria-pressed={auto}
            className="flex h-10 items-center gap-1.5 rounded-full bg-black/55 px-3 text-sm font-semibold text-white"
          >
            {auto ? <Zap className="h-4 w-4" aria-hidden /> : <ZapOff className="h-4 w-4" aria-hidden />}
            {auto ? t("Auto") : t("Manual")}
          </button>
          {quota?.remaining != null && quota.dailyLimit != null && quota.remaining <= quota.dailyLimit * 0.2 && (
            <span className="rounded-full bg-black/55 px-3 py-2 text-xs font-semibold text-white">
              {quota.remaining} {t("scans left today")}
            </span>
          )}
        </div>
      </div>

      {/* Bottom: queue + capture */}
      <div className="app-dark bg-background px-4 pb-[calc(var(--app-tabbar-h)+var(--app-safe-bottom)+12px)] pt-3">
        {limitHit && (
          <div className="mb-3">
            <SignInCard
              title={t("Daily scan limit reached. Create a free account for a bigger daily budget.")}
              body={t("Your cards sync across devices once you sign in.")}
              next="/app/scan"
            />
          </div>
        )}

        {queue.length > 0 && (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label={t("Queue")}>
            {queue.map(item => (
              <button
                key={item.id}
                type="button"
                role="listitem"
                onClick={() => item.status !== "identifying" && setReviewId(item.id)}
                className={`relative h-[84px] w-[60px] shrink-0 overflow-hidden rounded-lg border-2 ${
                  item.status === "ready"
                    ? "border-[var(--app-gold)]"
                    : item.status === "collected"
                      ? "border-[var(--app-up)]"
                      : item.status === "failed"
                        ? "border-[var(--app-down)]"
                        : "border-border"
                }`}
                aria-label={
                  item.result?.matches[0]?.name ?? item.error ?? t("Identifying…")
                }
              >
                <img
                  src={item.result?.matches[0]?.images.small ?? item.previewUrl}
                  alt=""
                  className={`h-full w-full object-cover ${
                    item.status === "identifying" ? "opacity-50" : ""
                  }`}
                />
                {item.status === "identifying" && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  </span>
                )}
                {item.status === "collected" && (
                  <span className="absolute bottom-0 left-0 right-0 bg-[var(--app-up)] py-0.5 text-center text-[10px] font-bold text-black">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            aria-label={t("Choose photo")}
          >
            <Images className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void capture()}
            disabled={camera !== "ready" || busy}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white/80 bg-white/10 active:scale-95 transition-transform disabled:opacity-40"
            aria-label={t("Capture")}
          >
            <span className="h-14 w-14 rounded-full bg-white" />
          </button>
          <div className="w-12 text-right">
            {readyCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const next = queue.find(q => q.status === "ready");
                  if (next) setReviewId(next.id);
                }}
                className="text-sm font-bold text-[var(--app-gold)]"
              >
                {t("Review")} {readyCount}
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
      </div>

      <ReviewSheet
        open={!!reviewItem && reviewItem.status === "ready"}
        onOpenChange={open => !open && setReviewId(null)}
        result={reviewItem?.result ?? null}
        draft={reviewItem?.draft ?? null}
        onDraftChange={draft => reviewItem && updateItem(reviewItem.id, { draft })}
        onCollected={() => reviewItem && updateItem(reviewItem.id, { status: "collected" })}
      />
    </div>
  );
}
