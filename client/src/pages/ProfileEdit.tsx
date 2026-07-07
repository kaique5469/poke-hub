import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Save, User } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function ProfileEdit() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  // Pre-fill from user data when available
  useEffect(() => {
    if (user?.name) {
      // username will be empty until user sets one
    }
  }, [user]);

  const updateMutation = trpc.players.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
      if (username) navigate(`/players/${username}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to update profile"),
  });

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sign In Required</h2>
        <Button className="bg-primary text-primary-foreground" onClick={() => window.location.href = getLoginUrl()}>
          Sign In
        </Button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      username: username.trim() || undefined,
      bio: bio.trim() || undefined,
    });
  };

  return (
    <div className="container py-8">
      <div className="max-w-lg mx-auto">
        {/* Back */}
        <Button variant="ghost" size="sm" asChild className="mb-6 gap-2 text-muted-foreground hover:text-foreground">
          <Link href={username ? `/players/${username}` : "/"}>
            <ArrowLeft className="w-4 h-4" /> Back to Profile
          </Link>
        </Button>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h1 className="font-display text-2xl font-bold text-foreground mb-6">Edit Profile</h1>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar preview */}
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {(user?.name ?? username ?? "?")[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">{user?.name ?? "Your Name"}</p>
                <p className="text-xs text-muted-foreground">Avatar is auto-generated from your name</p>
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Username <span className="text-muted-foreground font-normal">(public URL)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="your-username"
                  maxLength={64}
                  className="w-full pl-7 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                />
              </div>
              {username && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your profile URL: <span className="text-primary">tcgarena.gg/players/{username}</span>
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Bio <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself, your favorite format, or your goals…"
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
            </div>

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
            >
              {updateMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
