import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Users, TrendingUp, Trophy, Swords, BookMarked, MessageSquare, Heart, Share2, Plus, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "feed", label: "Feed", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "metagame", label: "Metagame", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "decks", label: "Decks", icon: <Swords className="w-4 h-4" /> },
  { id: "tournaments", label: "Tournaments", icon: <Trophy className="w-4 h-4" /> },
  { id: "binder", label: "Binder", icon: <BookMarked className="w-4 h-4" /> },
];

const SAMPLE_POSTS = [
  { id: 1, user: "TrainerAlex", avatar: "A", time: "2h ago", content: "Just pulled a Charizard ex Full Art from Obsidian Flames! This set is absolutely insane. My binder is getting expensive 😅", likes: 47, comments: 12, tags: ["Obsidian Flames", "Charizard"] },
  { id: 2, user: "PokéMaster99", avatar: "P", time: "4h ago", content: "My Gardevoir ex deck went 7-2 at the local Regional this weekend! The new Munkidori tech is absolutely broken. Full list in comments.", likes: 134, comments: 38, tags: ["Competitive", "Gardevoir", "Regional"] },
  { id: 3, user: "CardCollector", avatar: "C", time: "6h ago", content: "PSA 10 Pikachu Illustrator just sold for $900,000 at auction. The Pokémon TCG market never ceases to amaze me.", likes: 289, comments: 67, tags: ["Vintage", "Investment", "PSA"] },
  { id: 4, user: "SetReviewer", avatar: "S", time: "1d ago", content: "Full Prismatic Evolutions set review is up! TL;DR: Best set of the Scarlet & Violet era. The Eevee evolution full arts are stunning.", likes: 521, comments: 94, tags: ["Prismatic Evolutions", "Review"] },
];

const FEATURED_PLAYERS = [
  { name: "TrainerAlex", wins: 47, decks: 12, avatar: "A", rank: 1 },
  { name: "PokéMaster99", wins: 38, decks: 8, avatar: "P", rank: 2 },
  { name: "CardCollector", wins: 31, decks: 15, avatar: "C", rank: 3 },
  { name: "SetReviewer", wins: 28, decks: 6, avatar: "S", rank: 4 },
  { name: "DeckBuilder", wins: 24, decks: 21, avatar: "D", rank: 5 },
];

function PostCard({ post }: { post: typeof SAMPLE_POSTS[0] }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);

  return (
    <div className="community-post">
      <div className="flex items-start gap-3">
        <div className="avatar">{post.avatar}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/profile/${post.user}`} className="font-bold text-sm hover:underline" style={{ color: "oklch(0.18 0.02 240)" }}>{post.user}</Link>
            <span className="text-xs" style={{ color: "oklch(0.62 0.01 240)" }}>{post.time}</span>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "oklch(0.25 0.02 240)" }}>{post.content}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map(tag => (
              <span key={tag} className="badge badge-blue">#{tag}</span>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => { setLiked(!liked); setLikes(l => liked ? l - 1 : l + 1); }}
              className={cn("flex items-center gap-1.5 text-sm font-semibold transition-colors", liked ? "text-red-500" : "text-gray-500 hover:text-red-500")}>
              <Heart className="w-4 h-4" fill={liked ? "currentColor" : "none"} />
              {likes}
            </button>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-500 transition-colors">
              <MessageSquare className="w-4 h-4" />
              {post.comments}
            </button>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-blue-500 transition-colors">
              <Share2 className="w-4 h-4" />Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Community() {
  const [activeTab, setActiveTab] = useState("feed");
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.97 0.005 240)" }}>
      <div className="page-header">
        <div className="container">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black" style={{ color: "oklch(0.18 0.02 240)" }}>Community</h1>
              <p className="text-sm mt-0.5" style={{ color: "oklch(0.52 0.015 240)" }}>Connect with Pokémon TCG players across the USA</p>
            </div>
            {isAuthenticated ? (
              <button className="btn-primary text-sm"><Plus className="w-4 h-4" />New Post</button>
            ) : (
              <a href={getLoginUrl()} className="btn-primary text-sm"><Users className="w-4 h-4" />Join Community</a>
            )}
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="tab-list">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("tab-item flex items-center gap-1.5", activeTab === tab.id && "active")}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-4">
            {activeTab === "feed" && (
              <>
                {!isAuthenticated && (
                  <div className="card-white text-center py-6">
                    <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "oklch(0.52 0.22 255)" }} />
                    <p className="font-bold mb-1" style={{ color: "oklch(0.18 0.02 240)" }}>Join the Community</p>
                    <p className="text-sm mb-4" style={{ color: "oklch(0.52 0.015 240)" }}>Sign in to post, like, and interact with other players</p>
                    <a href={getLoginUrl()} className="btn-primary text-sm">Sign In</a>
                  </div>
                )}
                {SAMPLE_POSTS.map(post => <PostCard key={post.id} post={post} />)}
              </>
            )}
            {activeTab === "metagame" && (
              <div className="card-white text-center py-12">
                <TrendingUp className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.52 0.22 255)" }} />
                <p className="font-bold text-lg mb-2" style={{ color: "oklch(0.18 0.02 240)" }}>Metagame Analysis</p>
                <p className="text-sm mb-4" style={{ color: "oklch(0.52 0.015 240)" }}>See top decks, trends, and competitive insights</p>
                <Link href="/metagame" className="btn-primary text-sm">View Metagame</Link>
              </div>
            )}
            {activeTab === "decks" && (
              <div className="card-white text-center py-12">
                <Swords className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.52 0.22 255)" }} />
                <p className="font-bold text-lg mb-2" style={{ color: "oklch(0.18 0.02 240)" }}>Community Decks</p>
                <p className="text-sm mb-4" style={{ color: "oklch(0.52 0.015 240)" }}>Browse and share competitive decklists</p>
                <Link href="/deck-builder" className="btn-primary text-sm">Build a Deck</Link>
              </div>
            )}
            {activeTab === "tournaments" && (
              <div className="card-white text-center py-12">
                <Trophy className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.52 0.22 255)" }} />
                <p className="font-bold text-lg mb-2" style={{ color: "oklch(0.18 0.02 240)" }}>Tournament Hub</p>
                <p className="text-sm mb-4" style={{ color: "oklch(0.52 0.015 240)" }}>Results, standings, and upcoming events</p>
                <Link href="/tournaments" className="btn-primary text-sm">View Tournaments</Link>
              </div>
            )}
            {activeTab === "binder" && (
              <div className="card-white text-center py-12">
                <BookMarked className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(0.52 0.22 255)" }} />
                <p className="font-bold text-lg mb-2" style={{ color: "oklch(0.18 0.02 240)" }}>Collection Showcase</p>
                <p className="text-sm mb-4" style={{ color: "oklch(0.52 0.015 240)" }}>Share your binder and see others' collections</p>
                <Link href="/binder" className="btn-primary text-sm">My Binder</Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Top Players */}
            <div className="card-white">
              <h3 className="section-title text-base mb-4">
                <Trophy className="w-4 h-4" style={{ color: "oklch(0.62 0.18 85)" }} />
                Top Players
              </h3>
              <div className="space-y-3">
                {FEATURED_PLAYERS.map(player => (
                  <Link key={player.rank} href={`/profile/${player.name}`}
                    className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: player.rank <= 3 ? ["#F59E0B","#9CA3AF","#CD7F32"][player.rank-1] : "oklch(0.92 0.005 240)", color: player.rank <= 3 ? "white" : "oklch(0.45 0.015 240)" }}>
                      {player.rank}
                    </span>
                    <div className="avatar w-8 h-8 text-sm">{player.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "oklch(0.18 0.02 240)" }}>{player.name}</p>
                      <p className="text-xs" style={{ color: "oklch(0.52 0.015 240)" }}>{player.wins} wins · {player.decks} decks</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="card-white">
              <h3 className="section-title text-base mb-4">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: "Metagame Dashboard", href: "/metagame", icon: <TrendingUp className="w-4 h-4" /> },
                  { label: "Deck Builder", href: "/deck-builder", icon: <Swords className="w-4 h-4" /> },
                  { label: "Tournament Results", href: "/tournaments", icon: <Trophy className="w-4 h-4" /> },
                  { label: "My Binder", href: "/binder", icon: <BookMarked className="w-4 h-4" /> },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-semibold"
                    style={{ color: "oklch(0.35 0.02 240)" }}>
                    <span style={{ color: "oklch(0.52 0.22 255)" }}>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
