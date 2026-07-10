import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Search, ShoppingCart, User, ChevronDown, Menu, X, Bell,
  BookOpen, Layers, Package, Wrench, Users, Star, Trophy,
  TrendingUp, Zap, Shield, Heart, LogOut, Settings, BarChart2, Gamepad2 } from "lucide-react";
import ArenaLogo from "@/components/ArenaLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ─── Pokéball SVG Icon ────────────────────────────────────────────────────────
const PokeballIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.5" fill="white"/>
    <path d="M1 12h22" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="white"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    <path d="M1 12C1 6.477 5.477 2 11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M13 2C18.523 2 23 6.477 23 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ─── Binder Icon ──────────────────────────────────────────────────────────────
const BinderIcon = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="3" y="2" width="15" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M6 2v20" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="7" r="1" fill="currentColor"/>
    <circle cx="6" cy="12" r="1" fill="currentColor"/>
    <circle cx="6" cy="17" r="1" fill="currentColor"/>
    <path d="M9 7h6M9 12h6M9 17h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="16" y="2" width="5" height="20" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

// ─── Mega Menu Data ───────────────────────────────────────────────────────────
const navSections = [
  {
    id: "cards",
    color: "#7C3AED",
    label: "Cards",
    icon: <PokeballIcon size={18} />,
    items: [
      { label: "Card Database", href: "/cards", icon: <Search size={16}/>, desc: "Search all 15,000+ cards" },
      { label: "Editions / Sets", href: "/sets", icon: <Layers size={16}/>, desc: "Browse by set and series" },
      { label: "Marketplace", href: "/shop", icon: <ShoppingCart size={16}/>, desc: "Buy & sell products" },
      { label: "Sell on TCG Arena", href: "/sell", icon: <TrendingUp size={16}/>, desc: "Open your store for free" },
      { label: "Price Trends", href: "/cards?tab=trends", icon: <TrendingUp size={16}/>, desc: "Market price history" },
      { label: "Want List", href: "/bazaar", icon: <Heart size={16}/>, desc: "Cards you want to buy" },
      { label: "Auctions", href: "/auctions", icon: <Zap size={16}/>, desc: "Live card auctions" },
    ],
  },
  {
    id: "pokedex",
    color: "#d97706",
    label: "Pokédex",
    icon: <PokeballIcon size={18} />,
    items: [
      { label: "All Pokémon", href: "/pokedex", icon: <PokeballIcon size={16}/>, desc: "Complete Pokédex" },
      { label: "By Type", href: "/pokedex?view=type", icon: <Shield size={16}/>, desc: "Filter by element type" },
      { label: "By Region", href: "/pokedex?view=gen", icon: <Star size={16}/>, desc: "Kanto, Johto, Hoenn..." },
    ],
  },
  {
    id: "products",
    color: "#FF2E9A",
    label: "Products",
    icon: <Package size={18} />,
    items: [
      { label: "Booster Boxes", href: "/shop?cat=booster_box", icon: <Package size={16}/>, desc: "Sealed booster boxes" },
      { label: "Elite Trainer Boxes", href: "/shop?cat=etb", icon: <Package size={16}/>, desc: "ETBs & special sets" },
      { label: "Tins & Blisters", href: "/shop?cat=tin", icon: <Package size={16}/>, desc: "Tins, blisters & packs" },
      { label: "Booster Packs", href: "/shop?cat=booster_pack", icon: <Package size={16}/>, desc: "Single packs & blisters" },
      { label: "Collector Boxes", href: "/shop?cat=collector_box", icon: <Package size={16}/>, desc: "Special collections" },
    ],
  },
  {
    id: "accessories",
    color: "#0891b2",
    label: "Accessories",
    icon: <Wrench size={18} />,
    items: [
      { label: "Playmats", href: "/shop?cat=playmat", icon: <Wrench size={16}/>, desc: "Tournament playmats" },
      { label: "Sleeves", href: "/shop?cat=sleeves", icon: <Wrench size={16}/>, desc: "Card sleeves & protectors" },
      { label: "Deck Boxes", href: "/shop?cat=deck_box", icon: <Wrench size={16}/>, desc: "Storage & deck boxes" },
      { label: "Binders & Portfolios", href: "/shop?cat=binder_portfolio", icon: <BinderIcon size={16}/>, desc: "Card binders" },
      { label: "Damage Counters", href: "/shop?cat=damage_counter", icon: <Wrench size={16}/>, desc: "Counters & tokens" },
    ],
  },
  {
    id: "community",
    color: "#10b981",
    label: "Community",
    icon: <Users size={18} />,
    items: [
      { label: "Articles", href: "/articles", icon: <BookOpen size={16}/>, desc: "Strategy & news" },
      { label: "Decks", href: "/decks", icon: <Layers size={16}/>, desc: "Community deck lists" },
      { label: "Deck Builder", href: "/deck-builder", icon: <Wrench size={16}/>, desc: "Build your deck" },
      { label: "Binders", href: "/binder", icon: <BinderIcon size={16}/>, desc: "Public collections" },
      { label: "Bazaar", href: "/bazaar", icon: <Users size={16}/>, desc: "Trade & swap cards" },
      { label: "Guess Game", href: "/game", icon: <Gamepad2 size={16}/>, desc: "Guess the Pokémon, earn points" },
      { label: "Tournaments", href: "/tournaments", icon: <Trophy size={16}/>, desc: "Events & results" },
      { label: "Metagame", href: "/metagame", icon: <BarChart2 size={16}/>, desc: "Top decks & trends" },
    ],
  },
];

export default function Navbar() {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Live cart count + notifications
  const { data: cartCountData } = trpc.cart.count.useQuery(undefined, {
    enabled: isAuthenticated, refetchInterval: 60_000,
  });
  const cartCount = cartCountData ?? 0;

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated, refetchInterval: 60_000,
  });
  const { data: notifs } = trpc.notifications.list.useQuery(undefined, {
    enabled: isAuthenticated && notifOpen,
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setActiveMenu(null);
    setMobileOpen(false);
    setUserMenuOpen(false);
    setNotifOpen(false);
  }, [location]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/cards?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <>
      {/* ─── Top Bar ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "oklch(0.54 0.25 293)" }} className="text-white text-xs py-1.5 hidden md:block">
        <div className="container flex items-center justify-between">
          <span className="opacity-80">🇺🇸 The #1 Pokémon TCG Platform in the USA</span>
          <div className="flex items-center gap-4 opacity-80">
            <Link href="/articles" className="hover:opacity-100 transition-opacity">Blog</Link>
            <Link href="/tournaments" className="hover:opacity-100 transition-opacity">Tournaments</Link>
            <Link href="/sell" className="hover:opacity-100 transition-opacity">Start Selling</Link>
            <Link href="/game" className="hover:opacity-100 transition-opacity flex items-center gap-1.5">
              Guess Game
              <span className="text-[9px] font-black bg-[#F5B301] text-black rounded-full px-1.5 py-px leading-tight">NEW</span>
            </Link>
            <Link href="/drops" className="hover:opacity-100 transition-opacity">Drop Alerts</Link>
          </div>
        </div>
      </div>

      {/* ─── Main Header ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm" ref={menuRef}>
        <div className="container">
          <div className="flex items-center gap-4 h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <ArenaLogo size={38} />
            </Link>

            {/* Marketplace pill */}
            <Link href="/shop" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold text-white shrink-0" style={{ background: "oklch(0.54 0.25 293)" }}>
              <ShoppingCart size={14} />
              Marketplace
            </Link>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:flex">
              <div className="relative w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or code (PAL 123)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  style={{ "--tw-ring-color": "oklch(0.54 0.25 293)" } as React.CSSProperties}
                />
              </div>
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Mobile search */}
              <button
                className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
              >
                <Search size={20} className="text-gray-600" />
              </button>

              {isAuthenticated ? (
                <>
                  {/* Notifications */}
                  <div className="relative hidden sm:block">
                    <button
                      className="relative p-2 rounded-full hover:bg-gray-100 transition-colors flex"
                      aria-label="Notifications"
                      onClick={() => setNotifOpen(v => !v)}
                    >
                      <Bell size={20} className="text-gray-600" />
                      {(unreadCount ?? 0) > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 text-[10px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: "#DC2626" }}>
                          {(unreadCount ?? 0) > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {notifOpen && (
                      <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                          <span className="font-bold text-sm text-gray-900">Notifications</span>
                          {(unreadCount ?? 0) > 0 && (
                            <button
                              className="text-xs font-semibold text-blue-600 hover:underline"
                              onClick={() => markRead.mutate({})}
                            >
                              Mark all read
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {!notifs || notifs.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
                          ) : (
                            notifs.map((n: { id: number; title: string; message: string; isRead: boolean; createdAt: string | Date }) => (
                              <button
                                key={n.id}
                                className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!n.isRead ? "bg-blue-50/50" : ""}`}
                                onClick={() => { if (!n.isRead) markRead.mutate({ ids: [n.id] }); }}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.isRead && <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "oklch(0.54 0.25 293)" }} />}
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 line-clamp-1">{n.title}</div>
                                    <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{n.message}</div>
                                    <div className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cart */}
                  <Link href="/cart" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors hidden sm:flex">
                    <ShoppingCart size={20} className="text-gray-600" />
                    {cartCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: "oklch(0.54 0.25 293)" }}>
                        {cartCount}
                      </span>
                    )}
                  </Link>

                  {/* User Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "oklch(0.54 0.25 293)" }}>
                        {user?.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[80px] truncate">
                        {user?.name?.split(" ")[0] ?? "User"}
                      </span>
                      <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                        <div className="px-4 py-2 border-b border-gray-100 mb-1">
                          <div className="font-semibold text-sm text-gray-900 truncate">{user?.name}</div>
                          <div className="text-xs text-gray-400 truncate">{user?.email}</div>
                        </div>
                        {[
                          { href: "/profile", icon: <User size={15}/>, label: "My Profile" },
                          { href: "/binder", icon: <BinderIcon size={15}/>, label: "My Binder" },
                          { href: "/decks", icon: <Layers size={15}/>, label: "My Decks" },
                          { href: "/orders", icon: <Package size={15}/>, label: "My Orders" },
                          { href: "/sell-card", icon: <TrendingUp size={15}/>, label: "Sell Cards" },
                          { href: "/sell", icon: <Package size={15}/>, label: "My Store" },
                          { href: "/profile/edit", icon: <Settings size={15}/>, label: "Settings" },
                        ].map(item => (
                          <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <span className="text-gray-400">{item.icon}</span>
                            {item.label}
                          </Link>
                        ))}
                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => logout()}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors w-full"
                          >
                            <LogOut size={15}/>
                            Sign Out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <a href={getLoginUrl()} className="text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors hidden sm:block px-3 py-1.5">
                    Sign In
                  </a>
                  <a href={getLoginUrl()} className="text-sm font-bold px-4 py-2 rounded-full text-white transition-all hover:opacity-90 active:scale-95" style={{ background: "oklch(0.54 0.25 293)" }}>
                    Register
                  </a>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Menu"
              >
                {mobileOpen ? <X size={22} className="text-gray-700" /> : <Menu size={22} className="text-gray-700" />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Navigation Bar (Liga-style mega menu) ──────────────────────── */}
        <div className="border-t border-gray-100 hidden md:block relative" onMouseLeave={() => setActiveMenu(null)}>
          <div className="container">
            <nav className="flex items-stretch">
              {navSections.map(section => (
                <button
                  key={section.id}
                  onMouseEnter={() => setActiveMenu(section.id)}
                  onClick={() => setActiveMenu(activeMenu === section.id ? null : section.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold transition-all rounded-t-xl"
                  style={activeMenu === section.id
                    ? { background: section.color, color: "white" }
                    : { color: "#374151" }}
                >
                  <span style={{ color: activeMenu === section.id ? "white" : section.color }}>
                    {section.icon}
                  </span>
                  {section.label}
                  <ChevronDown size={13} className={`transition-transform ${activeMenu === section.id ? "rotate-180" : ""}`} />
                </button>
              ))}
            </nav>
          </div>

          {/* Full-width mega menu panel */}
          {activeMenu && (() => {
            const section = navSections.find(sec => sec.id === activeMenu);
            if (!section) return null;
            return (
              <div className="absolute top-full left-0 right-0 bg-white shadow-2xl border-t z-50 animate-fade-in"
                style={{ borderTopColor: section.color, borderTopWidth: "3px" }}>
                <div className="container py-5 grid grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-5">
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setActiveMenu(null)}
                      className="flex items-start gap-3 group"
                    >
                      <span
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-110"
                        style={{ background: section.color }}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-gray-800 group-hover:text-primary transition-colors">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-500 leading-snug mt-0.5">{item.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ─── Mobile Search ────────────────────────────────────────────────── */}
        {searchOpen && (
          <div className="md:hidden px-4 py-3 border-t border-gray-100 bg-white animate-fade-in">
            <form onSubmit={handleSearch} className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search cards, products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent"
              />
            </form>
          </div>
        )}

        {/* ─── Mobile Menu ──────────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 max-h-[80vh] overflow-y-auto animate-fade-in">
            {navSections.map(section => (
              <div key={section.id} className="border-b border-gray-100 last:border-0">
                <button
                  onClick={() => setActiveMenu(activeMenu === section.id ? null : section.id)}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-gray-400">{section.icon}</span>
                    {section.label}
                  </span>
                  <ChevronDown size={14} className={`text-gray-400 transition-transform ${activeMenu === section.id ? "rotate-180" : ""}`} />
                </button>
                {activeMenu === section.id && (
                  <div className="bg-gray-50 py-1">
                    {section.items.map(item => (
                      <Link key={item.href} href={item.href} className="flex items-center gap-3 px-6 py-2.5 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                        <span className="text-gray-400">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!isAuthenticated && (
              <div className="p-4 flex gap-3">
                <a href={getLoginUrl()} className="flex-1 text-center py-2.5 text-sm font-semibold border border-gray-200 rounded-full text-gray-700 hover:bg-gray-50">
                  Sign In
                </a>
                <a href={getLoginUrl()} className="flex-1 text-center py-2.5 text-sm font-bold rounded-full text-white" style={{ background: "oklch(0.54 0.25 293)" }}>
                  Register
                </a>
              </div>
            )}
          </div>
        )}
      </header>
    </>
  );
}
