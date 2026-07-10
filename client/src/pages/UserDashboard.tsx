import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  User, Package, Heart, ShoppingCart, Star, TrendingUp, Settings,
  ArrowRight, Plus, Eye, Clock, CheckCircle, XCircle, Zap, BookOpen, BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const tabs = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "binder", label: "My Binder", icon: Heart },
  { id: "decks", label: "My Decks", icon: BookOpen },
  { id: "orders", label: "Orders", icon: Package },
  { id: "selling", label: "Selling", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];

const mockOrders = [
  { id: "ORD-001", card: "Charizard ex SAR", set: "Obsidian Flames", price: 285.00, status: "delivered", date: "Jun 28, 2026", seller: "PokéCollector_US", img: "https://images.pokemontcg.io/sv3/215_hires.png" },
  { id: "ORD-002", card: "Umbreon VMAX Alt Art", set: "Evolving Skies", price: 420.00, status: "shipped", date: "Jul 1, 2026", seller: "RareFinds_NY", img: "https://images.pokemontcg.io/swsh7/215_hires.png" },
  { id: "ORD-003", card: "Pikachu VMAX Rainbow", set: "Vivid Voltage", price: 145.00, status: "processing", date: "Jul 3, 2026", seller: "CardKing_TX", img: "https://images.pokemontcg.io/swsh4/188_hires.png" },
];

const mockListings = [
  { id: "L-001", card: "Rayquaza VMAX Alt Art", set: "Evolving Skies", price: 380.00, condition: "NM", views: 142, watchers: 23, status: "active", img: "https://images.pokemontcg.io/swsh7/218_hires.png" },
  { id: "L-002", card: "Lugia V Alt Art", set: "Silver Tempest", price: 195.00, condition: "NM", views: 87, watchers: 11, status: "active", img: "https://images.pokemontcg.io/swsh11/186_hires.png" },
  { id: "L-003", card: "Base Set Charizard", set: "Base Set", price: 850.00, condition: "SP", views: 312, watchers: 45, status: "sold", img: "https://images.pokemontcg.io/base1/4_hires.png" },
];


/** Stripe Connect payouts card — shown in the Selling tab. */
function PayoutsCard() {
  const utils = trpc.useUtils();
  const status = trpc.store.connectStatus.useQuery();
  const onboard = trpc.store.connectOnboard.useMutation({
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (e) => toast.error(e.message),
  });

  if (status.isLoading) return null;
  const st = status.data;

  if (!st?.hasStore) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h3 className="font-bold text-gray-800">Sell on TCG Arena</h3>
          <p className="text-xs text-gray-400 mt-0.5">Open your free store to list cards and receive payments.</p>
        </div>
        <Link href="/open-store">
          <Button size="sm" className="text-white text-xs font-bold" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
            Open your store <ArrowRight size={12} className="ml-1" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800">Payouts</h3>
            {st.payoutsEnabled ? (
              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#065f46" }}>Active</span>
            ) : st.connected ? (
              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>Onboarding incomplete</span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: "#fee2e2", color: "#991b1b" }}>Not connected</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-md">
            {st.payoutsEnabled
              ? "Your Stripe account is connected. 95% of every card sale is transferred directly to you."
              : "Connect your Stripe account to receive card payments directly in your bank. Takes about 2 minutes."}
          </p>
        </div>
        {!st.payoutsEnabled && (
          <Button
            size="sm"
            disabled={onboard.isPending}
            onClick={() => onboard.mutate()}
            className="text-white text-xs font-bold shrink-0"
            style={{ background: "#635BFF", border: "none" }}
          >
            {onboard.isPending ? "Redirecting..." : st.connected ? "Finish Stripe setup" : "Connect Stripe"}
            <ArrowRight size={12} className="ml-1" />
          </Button>
        )}
        {st.payoutsEnabled && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs font-bold shrink-0"
            onClick={() => { void utils.store.connectStatus.invalidate(); toast.success("Status refreshed"); }}
          >
            Refresh status
          </Button>
        )}
      </div>
    </div>
  );
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  delivered: { bg: "#d1fae5", text: "#065f46", label: "Delivered" },
  shipped: { bg: "#dbeafe", text: "#1e40af", label: "Shipped" },
  processing: { bg: "#fef3c7", text: "#92400e", label: "Processing" },
  active: { bg: "#d1fae5", text: "#065f46", label: "Active" },
  sold: { bg: "#e0e7ff", text: "#3730a3", label: "Sold" },
};

export default function UserDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: binderCards, isLoading: loadingBinder } = trpc.binder.list.useQuery(
    undefined,
    { enabled: isAuthenticated, retry: false }
  );

  const { data: decks, isLoading: loadingDecks } = trpc.decks.myDecks.useQuery(
    undefined,
    { enabled: isAuthenticated, retry: false }
  );

  if (loading) {
    return (
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <div className="md:col-span-3 space-y-4">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <User size={28} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-black text-gray-800 mb-2">Sign In Required</h2>
          <p className="text-sm text-gray-500 mb-6">Access your dashboard, binder, decks, and orders by signing in.</p>
          <a href={getLoginUrl()} className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl" style={{ background: "oklch(0.54 0.25 293)" }}>
            Sign In to Continue
          </a>
        </div>
      </div>
    );
  }

  const binderValue: number = (binderCards ?? []).reduce((sum: number, c) => sum + (Number(c.priceUsd) || 0) * c.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-black shrink-0" style={{ background: "oklch(0.54 0.25 293)" }}>
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-black text-gray-900">{user?.name ?? "Trainer"}</h1>
              <p className="text-sm text-gray-400">{user?.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                  {user?.role === "admin" ? "⚡ Admin" : "🎮 Trainer"}
                </span>
                <span className="text-xs text-gray-400">Member since 2026</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/profile/edit">
                <Button variant="outline" size="sm" className="gap-1.5 text-sm font-semibold">
                  <Settings size={14} /> Edit Profile
                </Button>
              </Link>
              <Link href={`/profile/${user?.name?.toLowerCase().replace(/\s+/g, "-") ?? "me"}`}>
                <Button size="sm" className="gap-1.5 text-sm font-semibold text-white" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                  <Eye size={14} /> Public Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:w-48 shrink-0">
            <nav className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? "text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  style={activeTab === tab.id ? { background: "oklch(0.54 0.25 293)" } : {}}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Cards in Binder", value: binderCards?.length ?? 0, icon: Heart, color: "#ef4444" },
                    { label: "Binder Value", value: `$${(binderValue as number).toFixed(2)}`, icon: TrendingUp, color: "#10b981" },
                    { label: "My Decks", value: decks?.length ?? 0, icon: BookOpen, color: "#8b5cf6" },
                    { label: "Orders", value: mockOrders.length, icon: Package, color: "#f59e0b" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: stat.color + "20" }}>
                          <stat.icon size={16} style={{ color: stat.color }} />
                        </div>
                      </div>
                      <div className="text-xl font-black text-gray-800">{stat.value}</div>
                      <div className="text-xs text-gray-400">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" /> Recent Orders
                  </h3>
                  <div className="space-y-3">
                    {mockOrders.slice(0, 3).map(order => {
                      const s = statusColors[order.status];
                      return (
                        <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                          <img src={order.img} alt={order.card} className="w-10 h-14 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-800 truncate">{order.card}</div>
                            <div className="text-xs text-gray-400">{order.set} · {order.date}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-sm text-gray-800">${order.price.toFixed(2)}</div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s?.bg, color: s?.text }}>
                              {s?.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Browse Cards", href: "/cards", icon: "🃏", desc: "Find cards to add to your binder" },
                    { label: "Build a Deck", href: "/decks/builder", icon: "🔧", desc: "Create and share your deck" },
                    { label: "View Auctions", href: "/auctions", icon: "⚡", desc: "Bid on rare cards" },
                  ].map(link => (
                    <Link key={link.href} href={link.href}>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 poke-card hover:border-blue-200 transition-all">
                        <div className="text-2xl mb-2">{link.icon}</div>
                        <div className="font-bold text-sm text-gray-800">{link.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{link.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Binder Tab */}
            {activeTab === "binder" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">My Binder ({binderCards?.length ?? 0} cards)</h3>
                  <Link href="/binder">
                    <Button size="sm" className="text-white gap-1.5 text-xs font-bold" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                      <Eye size={12} /> Full Binder
                    </Button>
                  </Link>
                </div>
                {loadingBinder ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-lg" />)}
                  </div>
                ) : binderCards && binderCards.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {binderCards.slice(0, 15).map(card => (
                      <Link key={card.id} href={`/cards/${card.cardId}`}>
                        <div className="aspect-[2/3] bg-gray-50 rounded-lg border border-gray-100 overflow-hidden poke-card hover:border-blue-200 transition-all relative">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.cardName} className="w-full h-full object-contain p-1" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center p-1">{card.cardName}</div>
                          )}
                          {card.quantity > 1 && (
                            <span className="absolute top-1 right-1 text-[9px] font-black text-white bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">
                              {card.quantity}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <Heart size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Your binder is empty</p>
                    <Link href="/cards">
                      <Button size="sm" className="mt-3 text-white text-xs" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                        Browse Cards
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Decks Tab */}
            {activeTab === "decks" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800">My Decks ({decks?.length ?? 0})</h3>
                  <Link href="/decks/builder">
                    <Button size="sm" className="text-white gap-1.5 text-xs font-bold" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                      <Plus size={12} /> New Deck
                    </Button>
                  </Link>
                </div>
                {loadingDecks ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
                ) : decks && decks.length > 0 ? (
                  <div className="space-y-3">
                    {decks.map((deck: { id: number; name: string; format: string; cardCount?: number | null; isPublic: boolean }) => (
                      <Link key={deck.id} href={`/decks/${deck.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 poke-card hover:border-blue-200 transition-all">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-lg">
                            🃏
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-sm text-gray-800">{deck.name}</div>
                            <div className="text-xs text-gray-400">{deck.format} · {deck.cardCount ?? 0} cards</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {deck.isPublic && <Badge className="text-[10px]" style={{ background: "#d1fae5", color: "#065f46", border: "none" }}>Public</Badge>}
                            <ArrowRight size={14} className="text-gray-300" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No decks yet</p>
                    <Link href="/decks/builder">
                      <Button size="sm" className="mt-3 text-white text-xs" style={{ background: "oklch(0.54 0.25 293)", border: "none" }}>
                        Build Your First Deck
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === "orders" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 mb-4">Purchase History</h3>
                <div className="space-y-3">
                  {mockOrders.map(order => {
                    const s = statusColors[order.status];
                    return (
                      <div key={order.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
                        <img src={order.img} alt={order.card} className="w-12 h-16 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-800">{order.card}</div>
                          <div className="text-xs text-gray-400">{order.set}</div>
                          <div className="text-xs text-gray-400 mt-0.5">Seller: {order.seller} · {order.date}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-gray-800">${order.price.toFixed(2)}</div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: s?.bg, color: s?.text }}>
                            {s?.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selling Tab */}
            {activeTab === "selling" && (
              <div className="space-y-4">
                <PayoutsCard />
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">My Listings</h3>
                    <Button size="sm" className="text-white gap-1.5 text-xs font-bold" style={{ background: "oklch(0.54 0.25 293)", border: "none" }} onClick={() => toast.info("Listing creation coming soon!")}>
                      <Plus size={12} /> New Listing
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {mockListings.map(listing => {
                      const s = statusColors[listing.status];
                      return (
                        <div key={listing.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
                          <img src={listing.img} alt={listing.card} className="w-10 h-14 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-gray-800">{listing.card}</div>
                            <div className="text-xs text-gray-400">{listing.set} · {listing.condition}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Eye size={10} /> {listing.views} views</span>
                              <span className="flex items-center gap-1"><Star size={10} /> {listing.watchers} watching</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-gray-800">${listing.price.toFixed(2)}</div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: s?.bg, color: s?.text }}>
                              {s?.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Seller Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Sales", value: "$850.00", icon: "💰" },
                    { label: "Active Listings", value: "2", icon: "📋" },
                    { label: "Seller Rating", value: "5.0 ⭐", icon: "🏆" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                      <div className="text-2xl mb-1">{stat.icon}</div>
                      <div className="font-black text-gray-800">{stat.value}</div>
                      <div className="text-xs text-gray-400">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-bold text-gray-800 mb-4">Account Settings</h3>
                <div className="space-y-4">
                  {[
                    { label: "Display Name", value: user?.name ?? "", type: "text" },
                    { label: "Email", value: user?.email ?? "", type: "email" },
                  ].map(field => (
                    <div key={field.label}>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        defaultValue={field.value}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2"
                        readOnly
                      />
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button className="text-white font-bold" style={{ background: "oklch(0.54 0.25 293)", border: "none" }} onClick={() => toast.info("Settings saved!")}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
