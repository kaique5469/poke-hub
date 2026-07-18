import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  Database,
  Download,
  Edit3,
  FileUp,
  Minus,
  Plus,
  Search,
  Trash2,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";

type Condition = "M" | "NM" | "SP" | "MP" | "HP" | "D";

function csvCells(line: string) {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

const escapeCsv = (value: unknown) =>
  `"${String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replaceAll('"', '""')}"`;
const money = (value: number | null | undefined) =>
  value == null ? "—" : `$${value.toFixed(2)}`;

export default function Binder() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [cost, setCost] = useState("");
  const [source, setSource] = useState("purchase");
  const binder = trpc.binder.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const portfolio = trpc.market.portfolio.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const refresh = async () => {
    await Promise.all([
      utils.binder.list.invalidate(),
      utils.market.portfolio.invalidate(),
    ]);
  };
  const update = trpc.binder.update.useMutation({ onSuccess: refresh });
  const remove = trpc.binder.remove.useMutation({
    onSuccess: () => {
      toast.success("Card removed");
      void refresh();
    },
  });
  const importCsv = trpc.binder.importCsv.useMutation({
    onSuccess: result => {
      toast.success(`${result.imported} card rows imported`);
      if (result.rejected.length)
        toast.warning(`${result.rejected.length} rows were rejected`);
      void refresh();
    },
    onError: error => toast.error(error.message),
  });

  if (!isAuthenticated)
    return (
      <div className="container py-20 text-center">
        <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-black">Build your collection portfolio</h1>
        <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
          Track cost basis, current market value and collection performance with
          a free account.
        </p>
        <Button
          className="mt-6"
          onClick={() => {
            window.location.href = getLoginUrl();
          }}
        >
          Sign in free
        </Button>
      </div>
    );

  const cards = binder.data ?? [];
  const filtered = cards.filter(card =>
    `${card.cardName} ${card.setName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );
  const data = portfolio.data;

  const exportCsv = () => {
    const header = [
      "cardId",
      "cardName",
      "setName",
      "quantity",
      "condition",
      "purchasePriceUsd",
      "acquiredAt",
      "acquisitionSource",
      "gradingCompany",
      "grade",
      "notes",
    ];
    const rows = cards.map(card => [
      card.cardId,
      card.cardName,
      card.setName,
      card.quantity,
      card.condition,
      card.purchasePriceUsd,
      card.acquiredAt
        ? new Date(card.acquiredAt).toISOString().slice(0, 10)
        : "",
      card.acquisitionSource,
      card.gradingCompany,
      card.grade,
      card.notes,
    ]);
    const blob = new Blob(
      [[header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n")],
      { type: "text/csv" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "raritygrid-portfolio.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const readCsv = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000)
      return toast.error("CSV must be smaller than 2 MB");
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const headers = csvCells(lines.shift() ?? "");
    const index = (name: string) => headers.indexOf(name);
    if (index("cardId") < 0) return toast.error("CSV needs a cardId column");
    const rows = lines.slice(0, 100).map(line => {
      const values = csvCells(line);
      const optional = (name: string) =>
        index(name) >= 0 ? values[index(name)]?.trim() : "";
      const parsedQuantity = Number(optional("quantity") || 1);
      const quantity =
        Number.isInteger(parsedQuantity) &&
        parsedQuantity >= 1 &&
        parsedQuantity <= 99
          ? parsedQuantity
          : 1;
      const purchasePriceUsd = Number(optional("purchasePriceUsd"));
      const grade = Number(optional("grade"));
      const condition = ["M", "NM", "SP", "MP", "HP", "D"].includes(
        optional("condition")
      )
        ? (optional("condition") as Condition)
        : "NM";
      const acquisitionSource = [
        "purchase",
        "trade",
        "gift",
        "pull",
        "other",
      ].includes(optional("acquisitionSource"))
        ? (optional("acquisitionSource") as
            "purchase" | "trade" | "gift" | "pull" | "other")
        : undefined;
      const gradingCompany = ["PSA", "BGS", "CGC", "SGC", "Other"].includes(
        optional("gradingCompany")
      )
        ? (optional("gradingCompany") as
            "PSA" | "BGS" | "CGC" | "SGC" | "Other")
        : undefined;
      return {
        cardId: values[index("cardId")].trim(),
        quantity,
        condition,
        ...(Number.isFinite(purchasePriceUsd) &&
        purchasePriceUsd >= 0 &&
        optional("purchasePriceUsd")
          ? { purchasePriceUsd }
          : {}),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(optional("acquiredAt"))
          ? { acquiredAt: optional("acquiredAt") }
          : {}),
        ...(acquisitionSource ? { acquisitionSource } : {}),
        ...(gradingCompany ? { gradingCompany } : {}),
        ...(Number.isFinite(grade) &&
        grade >= 1 &&
        grade <= 10 &&
        (grade * 2) % 1 === 0 &&
        optional("grade")
          ? { grade }
          : {}),
        ...(optional("notes") ? { notes: optional("notes") } : {}),
      };
    });
    importCsv.mutate({ rows });
    if (lines.length > 100)
      toast.info(
        "Imported the first 100 rows. Upload the remainder in another file."
      );
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] py-8">
      <div className="container">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Collector portfolio
            </p>
            <h1 className="mt-2 text-4xl font-black text-gray-950">
              My collection
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Verified market observations, your real cost basis and no invented
              prices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={event => void readCsv(event.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button variant="outline" asChild>
              <Link href="/scanner">
                <Camera className="mr-2 h-4 w-4" />
                Scan card
              </Link>
            </Button>
            <Button
              variant="outline"
              disabled={!cards.length}
              onClick={exportCsv}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button asChild>
              <Link href="/cards">
                <Plus className="mr-2 h-4 w-4" />
                Add cards
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Cards" value={String(data?.totalCards ?? 0)} />
          <Stat label="Market value" value={money(data?.currentValue)} />
          <Stat label="Cost basis" value={money(data?.totalCost)} />
          <Stat
            label="Unrealized P/L"
            value={money(data?.unrealizedGain)}
            tone={(data?.unrealizedGain ?? 0) >= 0 ? "green" : "red"}
          />
          <Stat
            label="7-day move"
            value={
              data?.change7d == null
                ? "—"
                : `${data.change7d >= 0 ? "+" : ""}${data.change7d.toFixed(2)}%`
            }
            tone={(data?.change7d ?? 0) >= 0 ? "green" : "red"}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Price coverage: {data?.pricedCards ?? 0} of {data?.uniqueCards ?? 0}{" "}
          unique cards. Cost basis completed for {data?.costedCards ?? 0}. P/L
          excludes entries without a cost.
        </p>

        <div className="relative mt-7">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search your collection"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-violet-400"
          />
        </div>

        {binder.isLoading ? (
          <p className="py-16 text-center text-gray-500">Loading portfolio…</p>
        ) : !filtered.length ? (
          <div className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-14 text-center">
            <Database className="mx-auto h-9 w-9 text-gray-300" />
            <h2 className="mt-4 font-black">
              {search ? "No matching cards" : "Your portfolio starts here"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Add cards individually or import a CSV using canonical Pokémon TCG
              card IDs.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(card => {
              const position = data?.positions.find(row => row.id === card.id);
              return (
                <article
                  key={card.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-4">
                    <div className="h-28 w-20 shrink-0 rounded-lg bg-gray-100 p-1">
                      {card.imageUrl && (
                        <img
                          src={card.imageUrl}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-black text-gray-950">
                        {card.cardName}
                      </h2>
                      <p className="truncate text-xs text-gray-500">
                        {card.setName}
                      </p>
                      <p className="mt-2 text-lg font-black">
                        {money(position?.value)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {card.quantity} × {money(position?.currentPrice)} ·{" "}
                        {position?.source ?? "Unpriced"}
                      </p>
                      {position?.gain != null && (
                        <p
                          className={`mt-1 text-xs font-bold ${position.gain >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {position.gain >= 0 ? "+" : ""}
                          {money(position.gain)} vs. cost
                        </p>
                      )}
                    </div>
                  </div>
                  {editing === card.id ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                      <label className="text-xs text-gray-500">
                        Unit cost
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost}
                          onChange={e => setCost(e.target.value)}
                          className="mt-1 w-full rounded-lg border p-2 text-sm"
                        />
                      </label>
                      <label className="text-xs text-gray-500">
                        Source
                        <select
                          value={source}
                          onChange={e => setSource(e.target.value)}
                          className="mt-1 w-full rounded-lg border p-2 text-sm"
                        >
                          <option value="purchase">Purchase</option>
                          <option value="trade">Trade</option>
                          <option value="gift">Gift</option>
                          <option value="pull">Pack pull</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <Button
                        size="sm"
                        className="col-span-2"
                        onClick={() => {
                          update.mutate({
                            id: card.id,
                            purchasePriceUsd: cost ? Number(cost) : null,
                            acquisitionSource: source as "purchase",
                          });
                          setEditing(null);
                        }}
                      >
                        Save cost basis
                      </Button>
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-lg border p-1.5"
                        onClick={() =>
                          update.mutate({
                            id: card.id,
                            quantity: Math.max(1, card.quantity - 1),
                          })
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold">
                        {card.quantity}
                      </span>
                      <button
                        className="rounded-lg border p-1.5"
                        onClick={() =>
                          update.mutate({
                            id: card.id,
                            quantity: Math.min(99, card.quantity + 1),
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="rounded-lg border p-2 text-gray-500"
                        onClick={() => {
                          setEditing(editing === card.id ? null : card.id);
                          setCost(
                            card.purchasePriceUsd
                              ? String(card.purchasePriceUsd)
                              : ""
                          );
                          setSource(card.acquisitionSource ?? "purchase");
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg border p-2 text-red-600"
                        onClick={() => remove.mutate({ id: card.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-black ${tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-gray-950"}`}
      >
        {value}
      </p>
    </div>
  );
}
