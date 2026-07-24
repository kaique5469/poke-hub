import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Gift, Loader2, PackageCheck, ShieldCheck, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

const initial = {
  weekOffset: 0 as 0 | 1,
  prizeTitle: "",
  prizeDescription: "",
  prizeImageUrl: "",
  rulesUrl: "",
  authorizationReference: "",
  legalConfirmed: false,
};

export default function AdminGame() {
  const { user, isAuthenticated, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [form, setForm] = useState(initial);
  const overview = trpc.gameAdmin.overview.useQuery(undefined, {
    enabled: isAuthenticated && isAdmin,
  });
  const activate = trpc.gameAdmin.activate.useMutation({
    onSuccess: () => {
      toast.success("Weekly prize competition activated");
      setForm(initial);
      utils.gameAdmin.overview.invalidate();
      utils.game.weeklyLeaderboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const shipped = trpc.gameAdmin.markShipped.useMutation({
    onSuccess: () => {
      toast.success("Prize marked as shipped");
      utils.gameAdmin.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  if (loading) return <div className="container py-16">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="container py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-4 text-lg font-black">Admin access only</p>
        <Link href="/" className="mt-3 inline-block text-violet-700 underline">
          Return home
        </Link>
      </div>
    );

  return (
    <main className="min-h-screen bg-[#f6f7fb] py-10">
      <div className="container max-w-6xl space-y-8">
        <header>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-700">
            Admin · Community growth
          </p>
          <h1 className="mt-2 text-3xl font-black text-gray-950">
            Weekly Arena prizes
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            A prize is never advertised until official rules and an
            authorization reference are recorded here. Shipping details are
            restricted to this admin page.
          </p>
        </header>

        <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-violet-600" />
            <h2 className="text-xl font-black">Activate an authorized prize</h2>
          </div>
          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={event => {
              event.preventDefault();
              if (!form.legalConfirmed) return;
              activate.mutate({ ...form, legalConfirmed: true });
            }}
          >
            <label className="text-xs font-bold">
              Competition week
              <select
                value={form.weekOffset}
                onChange={event =>
                  setForm(value => ({
                    ...value,
                    weekOffset: Number(event.target.value) as 0 | 1,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
              >
                <option value={0}>Current week</option>
                <option value={1}>Next week</option>
              </select>
            </label>
            <Field
              label="Prize title"
              value={form.prizeTitle}
              onChange={prizeTitle =>
                setForm(value => ({ ...value, prizeTitle }))
              }
              required
            />
            <Field
              label="Prize description"
              value={form.prizeDescription}
              onChange={prizeDescription =>
                setForm(value => ({ ...value, prizeDescription }))
              }
            />
            <Field
              label="Real prize image URL (optional)"
              value={form.prizeImageUrl}
              onChange={prizeImageUrl =>
                setForm(value => ({ ...value, prizeImageUrl }))
              }
              type="url"
            />
            <Field
              label="Full public official-rules URL"
              value={form.rulesUrl}
              onChange={rulesUrl => setForm(value => ({ ...value, rulesUrl }))}
              type="url"
              required
            />
            <Field
              label="Authorization / certificate reference"
              value={form.authorizationReference}
              onChange={authorizationReference =>
                setForm(value => ({ ...value, authorizationReference }))
              }
              required
            />
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <input
                type="checkbox"
                checked={form.legalConfirmed}
                onChange={event =>
                  setForm(value => ({
                    ...value,
                    legalConfirmed: event.target.checked,
                  }))
                }
                className="mt-1"
              />
              I confirm a legal entity is responsible for this promotion, the
              complete rules are public, eligibility is limited to the United
              States and Brazil, every applicable jurisdiction requirement has
              been reviewed, the promotion has the required authorization, and
              the prize can be fulfilled as described.
            </label>
            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={!form.legalConfirmed || activate.isPending}
                className="rounded-full bg-violet-600 px-6 font-black"
              >
                {activate.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Activate prize competition
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <PackageCheck className="h-6 w-6 text-emerald-600" /> Fulfillment
            queue
          </h2>
          <div className="mt-5 space-y-3">
            {(overview.data?.claims ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No prize claims yet.</p>
            ) : (
              overview.data!.claims.map((row: any) => (
                <article key={row.claim.id} className="rounded-2xl border p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-[240px] flex-1">
                      <p className="font-black text-gray-950">
                        {row.competition.prizeTitle}
                      </p>
                      <p className="mt-1 text-sm font-bold text-gray-700">
                        {row.claim.fullName} · {row.claim.email}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {row.claim.addressLine1}, {row.claim.addressNumber}
                        {row.claim.addressLine2
                          ? ` — ${row.claim.addressLine2}`
                          : ""}
                        <br />
                        {row.claim.neighborhood
                          ? `${row.claim.neighborhood} · `
                          : ""}
                        {row.claim.city}, {row.claim.state} ·{" "}
                        {row.claim.country === "BR" ? "CEP" : "ZIP"}{" "}
                        {row.claim.postalCode} · {row.claim.country}
                        {row.claim.phone ? ` · ${row.claim.phone}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase text-emerald-800">
                      {row.claim.status}
                    </span>
                    {row.claim.status === "submitted" && (
                      <Button
                        variant="outline"
                        disabled={shipped.isPending}
                        onClick={() => {
                          const trackingCode = window.prompt("Tracking code");
                          if (trackingCode?.trim())
                            shipped.mutate({
                              claimId: row.claim.id,
                              trackingCode: trackingCode.trim(),
                            });
                        }}
                      >
                        Mark shipped
                      </Button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Trophy className="h-6 w-6 text-amber-500" /> Competition history
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-gray-400">
                <tr>
                  <th className="py-2">Week</th>
                  <th>Prize</th>
                  <th>Status</th>
                  <th>Winner</th>
                  <th>Authorization</th>
                </tr>
              </thead>
              <tbody>
                {(overview.data?.competitions ?? []).map((row: any) => (
                  <tr key={row.competition.id} className="border-t">
                    <td className="py-3 font-bold">
                      {row.competition.weekKey}
                    </td>
                    <td>{row.competition.prizeTitle}</td>
                    <td>{row.competition.status}</td>
                    <td>{row.winnerName ?? "—"}</td>
                    <td>{row.competition.authorizationReference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"
      />
    </label>
  );
}
