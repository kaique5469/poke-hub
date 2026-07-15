import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Eye,
  Heart,
  Package,
  Plus,
  Search,
  Settings,
  TrendingUp,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const tabs = [
  ["overview", "Overview", BarChart2],
  ["binder", "My binder", Heart],
  ["decks", "My decks", BookOpen],
  ["orders", "Orders", Package],
  ["selling", "Selling", TrendingUp],
  ["settings", "Settings", Settings],
] as const;
const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-600",
  disputed: "bg-red-100 text-red-700",
  active: "bg-emerald-100 text-emerald-800",
  sold: "bg-indigo-100 text-indigo-800",
};
const money = (value: number | string | null | undefined) =>
  `$${Number(value ?? 0).toFixed(2)}`;
const shortDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function PayoutsCard() {
  const utils = trpc.useUtils();
  const status = trpc.store.connectStatus.useQuery();
  const onboard = trpc.store.connectOnboard.useMutation({
    onSuccess: result => {
      window.location.href = result.url;
    },
    onError: error => toast.error(error.message),
  });
  if (status.isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  const current = status.data;
  if (!current?.hasStore)
    return (
      <Panel>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-black text-gray-950">
              Start selling on TCG Arena
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Open a store before publishing marketplace inventory.
            </p>
          </div>
          <Link href="/open-store">
            <Button>Open your store</Button>
          </Link>
        </div>
      </Panel>
    );
  return (
    <Panel>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-950">Seller payouts</h3>
            <Status
              value={current.payoutsEnabled ? "active" : "pending"}
              label={current.payoutsEnabled ? "Active" : "Setup required"}
            />
          </div>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            {current.payoutsEnabled
              ? "Your Stripe account can receive marketplace payouts."
              : "Complete Stripe onboarding to receive buyer payments safely."}
          </p>
        </div>
        {!current.payoutsEnabled ? (
          <Button disabled={onboard.isPending} onClick={() => onboard.mutate()}>
            {onboard.isPending
              ? "Redirecting…"
              : current.connected
                ? "Finish setup"
                : "Connect Stripe"}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => void utils.store.connectStatus.invalidate()}
          >
            Refresh status
          </Button>
        )}
      </div>
    </Panel>
  );
}

export default function UserDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const binder = trpc.binder.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const decks = trpc.decks.myDecks.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const purchases = trpc.orders.myPurchases.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const sales = trpc.orders.mySales.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const cardListings = trpc.listings.myListings.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const productListings = trpc.products.myListings.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  if (loading)
    return (
      <div className="container py-12">
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  if (!isAuthenticated)
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f6f7fb]">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
            <User className="h-7 w-7 text-violet-600" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-gray-950">
            Sign in to your dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Your real orders, inventory, binder and decks are private to your
            account.
          </p>
          <a
            href={getLoginUrl()}
            className="mt-6 inline-flex rounded-full bg-violet-600 px-6 py-3 text-sm font-black text-white"
          >
            Sign in
          </a>
        </div>
      </main>
    );

  const binderValue = (binder.data ?? []).reduce(
    (total, card) => total + Number(card.priceUsd ?? 0) * card.quantity,
    0
  );
  const orderRows = purchases.data ?? [];
  const salesRows = sales.data ?? [];
  const singleRows = cardListings.data ?? [];
  const sealedRows = productListings.data ?? [];
  const grossSales = salesRows
    .filter(row => row.order.status !== "cancelled")
    .reduce((total, row) => total + Number(row.order.totalUsd), 0);
  const activeListings =
    singleRows.filter(item => item.status === "active").length +
    sealedRows.filter(item => item.listing.status === "active").length;
  const username =
    user?.username ??
    user?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ??
    "trainer";

  return (
    <main className="min-h-screen bg-[#f6f7fb]">
      <section className="border-b border-gray-200 bg-white">
        <div className="container flex flex-col gap-4 py-7 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-600 text-2xl font-black text-white">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? "Trainer"}
                className="h-full w-full object-cover"
              />
            ) : (
              (user?.name?.[0]?.toUpperCase() ?? "T")
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">
              Trainer dashboard
            </p>
            <h1 className="truncate text-2xl font-black text-gray-950">
              {user?.name ?? "Trainer"}
            </h1>
            <p className="truncate text-sm text-gray-500">
              @{username} · Member since{" "}
              {user?.createdAt
                ? new Date(user.createdAt).getFullYear()
                : "recently"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/profile/edit">
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Edit profile
              </Button>
            </Link>
            <Link href={`/profile/${username}`}>
              <Button className="gap-2">
                <Eye className="h-4 w-4" />
                Public profile
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <div className="container grid gap-6 py-7 lg:grid-cols-[210px_1fr]">
        <nav className="h-fit overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm lg:sticky lg:top-4">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-black transition ${activeTab === id ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Stat
                  label="Cards in binder"
                  value={String(binder.data?.length ?? 0)}
                  icon={Heart}
                />
                <Stat
                  label="Binder value"
                  value={money(binderValue)}
                  icon={TrendingUp}
                />
                <Stat
                  label="Decks"
                  value={String(decks.data?.length ?? 0)}
                  icon={BookOpen}
                />
                <Stat
                  label="Purchases"
                  value={String(orderRows.length)}
                  icon={Package}
                />
              </div>
              <Panel>
                <Header
                  title="Recent purchases"
                  action={
                    <Link
                      href="/orders"
                      className="text-xs font-black text-violet-700"
                    >
                      Manage orders
                    </Link>
                  }
                />
                {purchases.isLoading ? (
                  <RowsLoading />
                ) : (
                  <OrderList
                    rows={orderRows.slice(0, 4)}
                    empty="You have not purchased anything yet."
                  />
                )}
              </Panel>
              <div className="grid gap-3 sm:grid-cols-3">
                <QuickLink
                  href="/cards"
                  title="Search real cards"
                  text="Use live card data and USD market references."
                  icon={Search}
                />
                <QuickLink
                  href="/sets"
                  title="Explore sets"
                  text="Browse cards and sealed products together."
                  icon={Package}
                />
                <QuickLink
                  href="/sell"
                  title="Manage your store"
                  text="Publish inventory and track real sales."
                  icon={TrendingUp}
                />
              </div>
            </div>
          )}
          {activeTab === "binder" && (
            <Panel>
              <Header
                title={`My binder (${binder.data?.length ?? 0})`}
                action={
                  <Link href="/binder">
                    <Button size="sm">Open full binder</Button>
                  </Link>
                }
              />
              {binder.isLoading ? (
                <RowsLoading />
              ) : binder.data?.length ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {binder.data.slice(0, 15).map(card => (
                    <Link
                      key={card.id}
                      href={`/cards/${card.cardId}`}
                      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                    >
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.cardName}
                          className="h-full w-full object-contain p-1 transition group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center p-2 text-center text-xs text-gray-400">
                          {card.cardName}
                        </span>
                      )}
                      {card.quantity > 1 && (
                        <span className="absolute right-1 top-1 rounded-full bg-gray-950 px-1.5 py-0.5 text-[9px] font-black text-white">
                          ×{card.quantity}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Heart}
                  text="Your binder is empty."
                  href="/cards"
                  action="Browse cards"
                />
              )}
            </Panel>
          )}
          {activeTab === "decks" && (
            <Panel>
              <Header
                title={`My decks (${decks.data?.length ?? 0})`}
                action={
                  <Link href="/decks/builder">
                    <Button size="sm" className="gap-1">
                      <Plus className="h-4 w-4" />
                      New deck
                    </Button>
                  </Link>
                }
              />
              {decks.isLoading ? (
                <RowsLoading />
              ) : decks.data?.length ? (
                <div className="space-y-2">
                  {decks.data.map(deck => (
                    <Link
                      key={deck.id}
                      href={`/decks/${deck.id}`}
                      className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-violet-300"
                    >
                      <BookOpen className="h-5 w-5 text-violet-600" />
                      <div className="flex-1">
                        <p className="font-black text-gray-950">{deck.name}</p>
                        <p className="text-xs capitalize text-gray-500">
                          {deck.format} · {deck.cardCount ?? 0} cards
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={BookOpen}
                  text="You have not created a deck yet."
                  href="/decks/builder"
                  action="Build a deck"
                />
              )}
            </Panel>
          )}
          {activeTab === "orders" && (
            <Panel>
              <Header
                title="Purchase history"
                action={
                  <Link href="/orders">
                    <Button size="sm">Full order center</Button>
                  </Link>
                }
              />
              {purchases.isLoading ? (
                <RowsLoading />
              ) : (
                <OrderList
                  rows={orderRows}
                  empty="You have not purchased anything yet."
                />
              )}
            </Panel>
          )}
          {activeTab === "selling" && (
            <div className="space-y-5">
              <PayoutsCard />
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Gross orders"
                  value={money(grossSales)}
                  icon={TrendingUp}
                />
                <Stat
                  label="Active listings"
                  value={String(activeListings)}
                  icon={Package}
                />
                <Stat
                  label="Seller rating"
                  value={
                    user?.sellerRating
                      ? Number(user.sellerRating).toFixed(1)
                      : "—"
                  }
                  icon={CheckCircle2}
                />
              </div>
              <Panel>
                <Header
                  title="My listings"
                  action={
                    <Link href="/sell">
                      <Button size="sm" className="gap-1">
                        <Plus className="h-4 w-4" />
                        Add inventory
                      </Button>
                    </Link>
                  }
                />
                {cardListings.isLoading || productListings.isLoading ? (
                  <RowsLoading />
                ) : !singleRows.length && !sealedRows.length ? (
                  <Empty
                    icon={Package}
                    text="You have no marketplace listings."
                    href="/sell"
                    action="List an item"
                  />
                ) : (
                  <div className="space-y-2">
                    {singleRows.map(listing => (
                      <ListingRow
                        key={`card-${listing.id}`}
                        name={listing.cardName}
                        subtitle={`${listing.setName ?? "Pokémon TCG"} · ${listing.condition} · ${listing.quantity} available`}
                        image={listing.imageUrl}
                        price={listing.priceUsd}
                        status={listing.status}
                      />
                    ))}
                    {sealedRows.map(row => (
                      <ListingRow
                        key={`product-${row.listing.id}`}
                        name={row.productName ?? "Sealed product"}
                        subtitle={`${row.listing.condition} · ${row.listing.quantity} available`}
                        image={row.productImageUrl}
                        price={row.listing.priceUsd}
                        status={row.listing.status}
                      />
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
          {activeTab === "settings" && (
            <Panel>
              <Header title="Account settings" />
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnly label="Display name" value={user?.name ?? ""} />
                <ReadOnly label="Email" value={user?.email ?? ""} />
                <ReadOnly
                  label="Username"
                  value={user?.username ?? "Not set"}
                />
                <ReadOnly
                  label="Account role"
                  value={user?.role === "admin" ? "Administrator" : "Trainer"}
                />
              </div>
              <Link href="/profile/edit">
                <Button className="mt-5 gap-2">
                  <Settings className="h-4 w-4" />
                  Edit profile settings
                </Button>
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {children}
    </section>
  );
}
function Header({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-black text-gray-950">{title}</h2>
      {action}
    </div>
  );
}
function Status({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${statusStyle[value] ?? "bg-gray-100 text-gray-600"}`}
    >
      {label ?? value}
    </span>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-violet-600" />
      <p className="mt-3 text-xl font-black text-gray-950">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
function RowsLoading() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
function Empty({
  icon: Icon,
  text,
  href,
  action,
}: {
  icon: React.ElementType;
  text: string;
  href: string;
  action: string;
}) {
  return (
    <div className="py-14 text-center">
      <Icon className="mx-auto h-8 w-8 text-gray-300" />
      <p className="mt-3 text-sm font-bold text-gray-500">{text}</p>
      <Link href={href}>
        <Button size="sm" className="mt-4">
          {action}
        </Button>
      </Link>
    </div>
  );
}
function OrderList({ rows, empty }: { rows: Array<any>; empty: string }) {
  if (!rows.length)
    return (
      <div className="py-12 text-center text-sm font-bold text-gray-400">
        {empty}
      </div>
    );
  return (
    <div className="space-y-2">
      {rows.map(row => {
        const name =
          row.cardListing?.cardName ?? row.productName ?? "Marketplace item";
        const image = row.cardListing?.imageUrl ?? row.productImageUrl;
        return (
          <div
            key={row.order.id}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
          >
            {image ? (
              <img
                src={image}
                alt={name}
                className="h-16 w-12 object-contain"
              />
            ) : (
              <div className="flex h-16 w-12 items-center justify-center rounded bg-gray-50">
                <Package className="h-5 w-5 text-gray-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-gray-950">
                {name}
              </p>
              <p className="text-xs text-gray-500">
                Order #{row.order.id} · {shortDate(row.order.createdAt)}
              </p>
              <p className="text-xs text-gray-400">
                Seller:{" "}
                {row.counterpartyName ??
                  row.counterpartyUsername ??
                  "Marketplace seller"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-black text-gray-950">
                {money(row.order.totalUsd)}
              </p>
              <Status value={row.order.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
function ListingRow({
  name,
  subtitle,
  image,
  price,
  status,
}: {
  name: string;
  subtitle: string;
  image?: string | null;
  price?: string | number | null;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
      {image ? (
        <img src={image} alt={name} className="h-16 w-12 object-contain" />
      ) : (
        <div className="flex h-16 w-12 items-center justify-center rounded bg-gray-50">
          <Package className="h-5 w-5 text-gray-300" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-950">{name}</p>
        <p className="truncate text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="text-right">
        <p className="font-black text-gray-950">{money(price)}</p>
        <Status value={status} />
      </div>
    </div>
  );
}
function QuickLink({
  href,
  title,
  text,
  icon: Icon,
}: {
  href: string;
  title: string;
  text: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-violet-300 hover:shadow-md"
    >
      <Icon className="h-5 w-5 text-violet-600" />
      <p className="mt-3 font-black text-gray-950">{title}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{text}</p>
    </Link>
  );
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <input
        readOnly
        value={value}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
      />
    </label>
  );
}
