import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { BookOpen, Check, Copy, Database, Globe, Lock, Trophy, User } from "lucide-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export default function PlayerProfile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading } = trpc.players.getProfile.useQuery(
    { username: username ?? "" },
    { enabled: !!username }
  );

  const isOwner = false; // openId not exposed in public profile

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Profile link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse max-w-2xl mx-auto">
          <div className="flex items-center gap-5 mb-8">
            <div className="w-20 h-20 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/2 mb-1" />
                <div className="h-3.5 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-20 text-center">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Player Not Found</h2>
        <p className="text-muted-foreground mb-6">This player profile doesn't exist or hasn't been set up yet.</p>
        <Button asChild variant="outline"><Link href="/">Go Home</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold text-primary">
                {(profile.name ?? profile.username ?? "?")[0].toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {profile.name ?? profile.username}
                </h1>
                <Badge variant="secondary" className="text-[10px] gap-1">
                    <Globe className="w-2.5 h-2.5" /> Public
                  </Badge>
              </div>
              {profile.username && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}
              {profile.bio && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{profile.bio}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Share"}
              </Button>
              {isOwner && (
                <Button size="sm" asChild className="bg-primary text-primary-foreground gap-1.5">
                  <Link href="/profile/edit">Edit Profile</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-2xl font-bold text-foreground font-display">{profile.publicDecks?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Decks Built
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-2xl font-bold text-foreground font-display">—</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Cards in Binder
            </p>
          </div>
          <div className="bg-card border border-[oklch(0.78_0.18_85/0.3)] rounded-xl p-5 col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold text-primary font-display">—</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Collection Value
            </p>
          </div>
        </div>

        {/* Public Decks */}
        {profile.publicDecks && profile.publicDecks.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> Public Decks
              </h3>
            </div>
            <div className="divide-y divide-border">
              {profile.publicDecks.map((deck: { id: number; name: string; format: string; cardCount: number; estimatedCostUsd?: string | number | null }) => (
                <Link key={deck.id} href={`/decks/${deck.id}`}>
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-accent/20 transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{deck.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{deck.format} · {deck.cardCount} cards</p>
                    </div>
                    {deck.estimatedCostUsd && (
                      <p className="text-sm font-bold text-primary shrink-0">
                        ${parseFloat(String(deck.estimatedCostUsd)).toFixed(2)}
                      </p>
                    )}
                    <Badge variant="secondary" className="text-[10px] shrink-0">View</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}


      </div>
    </div>
  );
}
