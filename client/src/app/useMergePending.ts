/**
 * Once the user is signed in, push the device queue into the binder.
 * Runs at most once per sign-in; server-side idempotency makes a retry safe.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getPending, removePending } from "./pending";
import { track } from "./analytics";
import { useCount, useT } from "./i18n";

export function useMergePending() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const addMany = trpc.binder.addMany.useMutation();
  const t = useT();
  const count = useCount();
  const mergedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user || mergedFor.current === user.id) return;
    const items = getPending();
    if (items.length === 0) {
      mergedFor.current = user.id;
      return;
    }
    mergedFor.current = user.id;
    addMany
      .mutateAsync({
        items: items.map(item => ({
          clientId: item.localId,
          cardId: item.cardId,
          cardName: item.cardName,
          setId: item.setId,
          setName: item.setName,
          imageUrl: item.imageUrl,
          rarity: item.rarity,
          quantity: item.quantity,
          condition: item.condition,
          variant: item.variant,
          language: item.language,
          priceUsd: item.priceUsd ?? undefined,
          purchasePriceUsd: item.purchasePriceUsd,
          acquisitionSource: "pull",
        })),
      })
      .then(result => {
        removePending(result.clientIds);
        track("pending_merged", {
          inserted: result.inserted,
          skipped: result.skipped,
        });
        utils.binder.list.invalidate();
        utils.market.portfolio.invalidate();
        if (result.inserted > 0) {
          toast.success(
            `${count(result.inserted, "card", "cards")} · ${t("Added to collection")}`
          );
        }
      })
      .catch(() => {
        // Keep the queue; the next sign-in or app open retries.
        mergedFor.current = null;
      });
  }, [isAuthenticated, user, addMany, utils, t, count]);
}
