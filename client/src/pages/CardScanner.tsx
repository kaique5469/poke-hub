import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type Condition = "M" | "NM" | "SP" | "MP" | "HP" | "D";
type Source = "purchase" | "trade" | "gift" | "pull" | "other";

type ScanAnalysis = {
  isPokemonCard: boolean;
  name: string | null;
  collectorNumber: string | null;
  printedTotal: number | null;
  setName: string | null;
  setCode: string | null;
  languageCode: string | null;
  variant: string | null;
  graded: boolean;
  gradingCompany: string | null;
  grade: string | null;
  certificationNumber: string | null;
  confidence: number;
  notes: string;
};

type ScannerMatch = {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  set: { id: string; name: string; printedTotal: number };
  images: { small: string; large: string };
  marketPriceUsd: number | null;
  matchScore: number;
};

type ScanResult = {
  analysis: ScanAnalysis;
  matches: ScannerMatch[];
  quota: { remaining: number; dailyLimit: number };
  privacy: string;
};

async function loadImage(file: File) {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressCardPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 12_000_000)
    throw new Error("Photo must be smaller than 12 MB.");

  const source = await loadImage(file);
  const width = source.width;
  const height = source.height;
  const longest = Math.max(width, height);
  const scale = Math.min(1, 1800 / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser cannot prepare the photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source && typeof source.close === "function") source.close();

  const makeBlob = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        blob =>
          blob ? resolve(blob) : reject(new Error("Photo conversion failed.")),
        "image/jpeg",
        quality
      )
    );
  let blob = await makeBlob(0.86);
  if (blob.size > 2_800_000) blob = await makeBlob(0.72);
  if (blob.size > 3_000_000)
    throw new Error("Photo is still too large. Move closer and try again.");
  return blob;
}

function confidenceLabel(score: number) {
  if (score >= 80) return "Strong catalog match";
  if (score >= 55) return "Likely match";
  return "Review carefully";
}

export default function CardScanner() {
  const { isAuthenticated } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "preparing" | "scanning">(
    "idle"
  );
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScannerMatch | null>(null);
  const [condition, setCondition] = useState<Condition | "">("");
  const [quantity, setQuantity] = useState(1);
  const [cost, setCost] = useState("");
  const [source, setSource] = useState<Source>("purchase");
  const utils = trpc.useUtils();
  const addToBinder = trpc.binder.add.useMutation({
    onSuccess: async () => {
      toast.success("Card added to your collection");
      await Promise.all([
        utils.binder.list.invalidate(),
        utils.market.portfolio.invalidate(),
      ]);
    },
    onError: err => toast.error(err.message),
  });

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setSelected(null);
    setCondition("");
    setCost("");
    setError(null);
    addToBinder.reset();
    if (cameraRef.current) cameraRef.current.value = "";
    if (uploadRef.current) uploadRef.current.value = "";
  };

  const scan = async (file?: File) => {
    if (!file) return;
    reset();
    setPreview(URL.createObjectURL(file));
    setStatus("preparing");
    try {
      const blob = await compressCardPhoto(file);
      setStatus("scanning");
      const response = await fetch("/api/scanner/identify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "image/jpeg", Accept: "application/json" },
        body: blob,
      });
      const data = (await response.json().catch(() => ({}))) as
        ScanResult | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "The scanner could not process this photo."
        );
      }
      const scanResult = data as ScanResult;
      setResult(scanResult);
      if (scanResult.matches.length === 1) {
        setSelected(scanResult.matches[0]);
      }
    } catch (scanError) {
      setError(
        scanError instanceof Error
          ? scanError.message
          : "The scanner could not process this photo."
      );
    } finally {
      setStatus("idle");
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-[70vh] bg-[#f6f7fb] px-4 py-20">
        <div className="mx-auto max-w-lg rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <Camera className="mx-auto h-14 w-14 text-violet-600" />
          <h1 className="mt-5 text-3xl font-black text-gray-950">
            Scan a Pokémon card
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            Sign in to identify a card from a photo and add the confirmed
            catalog entry to your collection or marketplace listing.
          </p>
          <Button
            className="mt-7 w-full"
            onClick={() => (window.location.href = getLoginUrl())}
          >
            Sign in free
          </Button>
        </div>
      </main>
    );
  }

  const busy = status !== "idle";
  return (
    <main className="min-h-screen bg-[#f6f7fb] py-8 sm:py-12">
      <div className="container max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-950 via-violet-800 to-cyan-700 px-6 py-9 text-white sm:px-10">
          <div className="flex max-w-3xl items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-cyan-200">
            <Sparkles className="h-4 w-4" /> Collector tool
          </div>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Card Scanner</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">
            Photograph one English Pokémon TCG card. RarityGrid reads the
            printed details, then confirms possible matches against the
            canonical catalog.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-violet-100">
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="h-4 w-4" /> Photo not stored by RarityGrid
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Catalog confirmation required
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-violet-600">
                  Step 1
                </p>
                <h2 className="mt-1 text-xl font-black text-gray-950">
                  Take a clear photo
                </h2>
              </div>
              {(preview || result) && (
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-violet-600"
                >
                  <RotateCcw className="h-4 w-4" /> Start over
                </button>
              )}
            </div>

            <input
              ref={cameraRef}
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={event => void scan(event.target.files?.[0])}
            />
            <input
              ref={uploadRef}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              onChange={event => void scan(event.target.files?.[0])}
            />

            <div className="relative mt-5 aspect-[3/4] max-h-[520px] overflow-hidden rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50">
              {preview ? (
                <img
                  src={preview}
                  alt="Card ready to scan"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  <div className="rounded-full bg-white p-5 shadow-sm">
                    <Camera className="h-10 w-10 text-violet-600" />
                  </div>
                  <p className="mt-5 font-black text-gray-900">
                    Place one card inside the frame
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">
                    Use even lighting, avoid sleeve glare and keep the collector
                    number visible.
                  </p>
                </div>
              )}
              {busy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-violet-950/75 text-white backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin" />
                  <p className="mt-4 font-black">
                    {status === "preparing"
                      ? "Preparing photo…"
                      : "Reading printed details…"}
                  </p>
                  <p className="mt-1 text-xs text-violet-200">
                    Usually takes a few seconds
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button
                size="lg"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" /> Use camera
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={busy}
                onClick={() => uploadRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" /> Upload photo
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-gray-400">
              Up to 10 scans per account each day during launch.
            </p>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-black uppercase tracking-widest text-violet-600">
              Step 2
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-950">
              Confirm the exact printing
            </h2>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="font-bold text-red-900">Scan unsuccessful</p>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/cards">
                    <Search className="mr-2 h-4 w-4" /> Search manually
                  </Link>
                </Button>
              </div>
            )}

            {!result && !error && (
              <div className="mt-5 rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-6 py-20 text-center">
                <Search className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-4 font-black text-gray-700">
                  Matches will appear here
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  You always choose the final catalog entry.
                </p>
              </div>
            )}

            {result && (
              <div className="mt-5 space-y-5">
                <div className="rounded-2xl bg-gray-950 p-4 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                        Photo reading
                      </p>
                      <p className="mt-1 font-black">
                        {result.analysis.name ?? "No Pokémon card detected"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                      {Math.round(result.analysis.confidence * 100)}% readable
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-300">
                    {[
                      result.analysis.setName,
                      result.analysis.collectorNumber &&
                      result.analysis.printedTotal
                        ? `${result.analysis.collectorNumber}/${result.analysis.printedTotal}`
                        : result.analysis.collectorNumber,
                      result.analysis.languageCode,
                      result.analysis.variant,
                    ]
                      .filter(Boolean)
                      .join(" · ") || result.analysis.notes}
                  </p>
                </div>

                {!result.matches.length ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                    <p className="font-black">No safe catalog match</p>
                    <p className="mt-1 leading-6">
                      Try a sharper front photo or find the card manually.
                      RarityGrid will not create a listing from an unconfirmed
                      AI result.
                    </p>
                    <Button asChild variant="outline" className="mt-4">
                      <Link
                        href={`/cards?q=${encodeURIComponent(result.analysis.name ?? "")}`}
                      >
                        <Search className="mr-2 h-4 w-4" /> Search catalog
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {result.matches.map(card => (
                      <button
                        key={card.id}
                        onClick={() => {
                          addToBinder.reset();
                          setSelected(card);
                        }}
                        className={`flex w-full gap-4 rounded-2xl border p-3 text-left transition ${selected?.id === card.id ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-gray-200 hover:border-violet-300"}`}
                      >
                        <img
                          src={card.images.small}
                          alt={card.name}
                          className="h-28 w-20 shrink-0 object-contain"
                        />
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-black text-gray-950">
                                {card.name}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {card.set.name} · #{card.number}/
                                {card.set.printedTotal}
                              </p>
                            </div>
                            {selected?.id === card.id && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-600" />
                            )}
                          </div>
                          <p className="mt-3 text-xs font-bold text-violet-700">
                            {confidenceLabel(card.matchScore)} ·{" "}
                            {card.matchScore}%
                          </p>
                          {card.marketPriceUsd != null && (
                            <p className="mt-1 text-sm font-black text-emerald-600">
                              ${card.marketPriceUsd.toFixed(2)} market reference
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {result.privacy} {result.quota.remaining} of{" "}
                  {result.quota.dailyLimit} scans remain today.
                </p>
              </div>
            )}

            {selected && (
              <div className="mt-6 rounded-3xl border border-violet-200 bg-violet-50 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-violet-700">
                  Step 3 · Your confirmation
                </p>
                <h3 className="mt-2 font-black text-gray-950">
                  What do you want to do with {selected.name}?
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold text-gray-600">
                    Condition — required
                    <select
                      value={condition}
                      onChange={event =>
                        setCondition(event.target.value as Condition | "")
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm"
                    >
                      <option value="">Choose condition</option>
                      <option value="M">Mint</option>
                      <option value="NM">Near Mint</option>
                      <option value="SP">Slightly Played</option>
                      <option value="MP">Moderately Played</option>
                      <option value="HP">Heavily Played</option>
                      <option value="D">Damaged</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Quantity
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={quantity}
                      onChange={event =>
                        setQuantity(
                          Math.max(
                            1,
                            Math.min(99, Number(event.target.value) || 1)
                          )
                        )
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    Your unit cost (optional)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cost}
                      onChange={event => setCost(event.target.value)}
                      placeholder="0.00"
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm"
                    />
                  </label>
                  <label className="text-xs font-bold text-gray-600">
                    How acquired
                    <select
                      value={source}
                      onChange={event =>
                        setSource(event.target.value as Source)
                      }
                      className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm"
                    >
                      <option value="purchase">Purchase</option>
                      <option value="trade">Trade</option>
                      <option value="gift">Gift</option>
                      <option value="pull">Pack pull</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <p className="mt-4 flex gap-2 text-xs leading-5 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  The scanner identifies the catalog entry. It does not certify
                  authenticity, condition, grading, or value.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    disabled={
                      !condition ||
                      addToBinder.isPending ||
                      addToBinder.isSuccess
                    }
                    onClick={() => {
                      if (!condition) return;
                      addToBinder.mutate({
                        cardId: selected.id,
                        cardName: selected.name,
                        setId: selected.set.id,
                        setName: selected.set.name,
                        imageUrl:
                          selected.images.large || selected.images.small,
                        rarity: selected.rarity ?? undefined,
                        quantity,
                        condition,
                        acquisitionSource: source,
                        ...(cost &&
                        Number.isFinite(Number(cost)) &&
                        Number(cost) >= 0
                          ? { purchasePriceUsd: Number(cost) }
                          : {}),
                      });
                    }}
                  >
                    {addToBinder.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}{" "}
                    {addToBinder.isSuccess
                      ? "Added to collection"
                      : "Add to collection"}
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={`/sell-card?card=${encodeURIComponent(selected.id)}`}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" /> Create sale
                      listing
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
