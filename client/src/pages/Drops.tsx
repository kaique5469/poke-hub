import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import { Bell, BellOff, ExternalLink, Package, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const RETAILER_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  "pokemon_center": { bg: "bg-[oklch(0.78_0.18_85/0.1)]", text: "text-[oklch(0.78_0.18_85)]", border: "border-[oklch(0.78_0.18_85/0.3)]", label: "Pokémon Center" },
  "amazon": { bg: "bg-[oklch(0.78_0.18_50/0.1)]", text: "text-[oklch(0.78_0.18_50)]", border: "border-[oklch(0.78_0.18_50/0.3)]", label: "Amazon" },
  "target": { bg: "bg-[oklch(0.60_0.22_35/0.1)]", text: "text-[oklch(0.60_0.22_35)]", border: "border-[oklch(0.60_0.22_35/0.3)]", label: "Target" },
};

export default function Drops() {
  const { isAuthenticated } = useAuth();
  const [newProductName, setNewProductName] = useState("");
  const [newRetailer, setNewRetailer] = useState("pokemon_center");


  const { data, isLoading, refetch } = trpc.alerts.list.useQuery(undefined, { enabled: isAuthenticated });
  const createMutation = trpc.alerts.create.useMutation({
    onSuccess: () => { toast.success("Drop alert created!"); refetch(); setNewProductName(""); },
    onError: () => toast.error("Failed to create alert"),
  });
  const deleteMutation = trpc.alerts.delete.useMutation({
    onSuccess: () => { toast.success("Alert removed"); refetch(); },
  });
  const toggleMutation = trpc.alerts.toggle.useMutation({
    onSuccess: () => refetch(),
  });

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sign In for Drop Alerts</h2>
        <p className="text-muted-foreground mb-6">
          Get notified when Pokémon Center, Amazon, and Target restock products you want.
        </p>
        <Button className="bg-primary text-primary-foreground" onClick={() => window.location.href = getLoginUrl()}>
          Sign In Free
        </Button>
      </div>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    createMutation.mutate({
      productName: newProductName.trim(),
      retailer: newRetailer as "pokemon_center" | "amazon" | "target",
    });
  };

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[oklch(0.80_0.20_90/0.1)] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[oklch(0.80_0.20_90)]" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground">Drop Alerts</h1>
        </div>
        <p className="text-muted-foreground">
          Monitor Pokémon Center, Amazon, and Target for product restocks
        </p>
      </div>

      {/* Retailers info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Object.entries(RETAILER_STYLES).map(([key, style]) => (
          <div key={key} className={cn("rounded-xl border p-4 flex items-center gap-3", style.bg, style.border)}>
            <Package className={cn("w-5 h-5 shrink-0", style.text)} />
            <div>
              <p className={cn("font-semibold text-sm", style.text)}>{style.label}</p>
              <p className="text-xs text-muted-foreground">Restock monitoring active</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Alert Form */}
      <div className="bg-card border border-border rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Add New Alert
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Product name (e.g. Prismatic Evolutions ETB)"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              required
            />
          </div>
          <Select value={newRetailer} onValueChange={setNewRetailer}>
            <SelectTrigger className="bg-background border-border text-sm">
              <SelectValue placeholder="Retailer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pokemon_center">Pokémon Center</SelectItem>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="target">Target</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={createMutation.isPending || !newProductName.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-2"
          >
            {createMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            Set Alert
          </Button>
        </form>
      </div>

      {/* Alert List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">No alerts set</p>
          <p className="text-muted-foreground text-sm">Add a product above to start monitoring for restocks</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.length} active alert{data.length !== 1 ? "s" : ""}</p>
          {data.map((alert: typeof data[0]) => {
            const retailerStyle = RETAILER_STYLES[alert.retailer] ?? RETAILER_STYLES["amazon"];
            return (
              <div
                key={alert.id}
                className={cn(
                  "bg-card border rounded-xl p-4 flex items-center gap-4 transition-colors",
                  alert.isActive ? "border-border" : "border-border/50 opacity-60"
                )}
              >
                {/* Retailer icon */}
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border", retailerStyle.bg, retailerStyle.border)}>
                  <Package className={cn("w-5 h-5", retailerStyle.text)} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{alert.productName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn("text-xs font-medium", retailerStyle.text)}>{retailerStyle.label}</span>
                  </div>
                </div>

                {/* Status */}
<Badge variant="secondary" className="text-[10px] font-bold uppercase shrink-0 bg-muted text-muted-foreground">
                  {alert.lastTriggered ? `✓ Triggered ${new Date(alert.lastTriggered).toLocaleDateString()}` : "Monitoring"}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: alert.id, isActive: !alert.isActive })}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      alert.isActive
                        ? "text-primary bg-primary/10 hover:bg-primary/20"
                        : "text-muted-foreground bg-muted hover:bg-muted/80"
                    )}
                    title={alert.isActive ? "Pause alert" : "Resume alert"}
                  >
                    {alert.isActive ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: alert.id })}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <p className="text-xs text-muted-foreground text-center mt-8">
        Alerts check for restocks periodically. You'll be notified via browser notification when a product becomes available.
        Links go directly to the retailer's product page.
      </p>
    </div>
  );
}
