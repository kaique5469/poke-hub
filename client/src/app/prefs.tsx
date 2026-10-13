/**
 * App preferences: UI language, display currency and the USD→BRL rate.
 *
 * Resolution order for each preference: the signed-in user's saved value →
 * this device's saved value → browser language. Changes persist locally at
 * once and to the account when signed in.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  APP_STORAGE_KEYS,
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  defaultCurrencyForLocale,
  detectLocale,
  isAppCurrency,
  isAppLocale,
  type AppCurrency,
  type AppLocale,
} from "@shared/app";
import { I18nProvider } from "./i18n";

type FxRates = {
  base: "USD";
  rates: Record<AppCurrency, number>;
  asOf: string;
  source: "frankfurter" | "cache" | "fallback";
};

type PrefsValue = {
  locale: AppLocale;
  currency: AppCurrency;
  fx: FxRates | null;
  setLocale: (locale: AppLocale) => void;
  setCurrency: (currency: AppCurrency) => void;
  /** Converts a USD amount into the display currency (null stays null). */
  toDisplay: (usd: number | null | undefined) => number | null;
  /** Formats a USD amount in the display currency, e.g. "R$ 12,34". */
  money: (usd: number | null | undefined, opts?: MoneyOptions) => string;
  /** Formats an amount already in the given currency. */
  moneyIn: (
    amount: number | null | undefined,
    currency: AppCurrency,
    opts?: MoneyOptions
  ) => string;
  /** The "other" currency, for the small secondary line under a price. */
  secondaryCurrency: AppCurrency;
};

type MoneyOptions = { compact?: boolean; signed?: boolean };

const FALLBACK_FX: FxRates = {
  base: "USD",
  rates: { USD: 1, BRL: 5.5 },
  asOf: "fallback",
  source: "fallback",
};

const PrefsContext = createContext<PrefsValue | null>(null);

function readStored<T>(key: string, guard: (v: unknown) => v is T): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return guard(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the preference lives for this session.
  }
}

function localeTag(locale: AppLocale) {
  return locale === "pt-BR" ? "pt-BR" : "en-US";
}

export function formatMoney(
  amount: number | null | undefined,
  currency: AppCurrency,
  locale: AppLocale,
  opts: MoneyOptions = {}
) {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const formatter = new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: opts.compact && Math.abs(amount) >= 1000 ? 0 : 2,
    maximumFractionDigits: opts.compact && Math.abs(amount) >= 1000 ? 0 : 2,
    notation: opts.compact && Math.abs(amount) >= 100_000 ? "compact" : "standard",
  });
  const text = formatter.format(Math.abs(amount));
  if (opts.signed) return `${amount < 0 ? "−" : "+"}${text}`;
  return amount < 0 ? `−${text}` : text;
}

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const updatePrefs = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const fxQuery = trpc.site.fx.useQuery(undefined, {
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    return (
      readStored(APP_STORAGE_KEYS.locale, isAppLocale) ??
      detectLocale(navigator.languages ?? [navigator.language])
    );
  });
  const [currency, setCurrencyState] = useState<AppCurrency>(() => {
    if (typeof window === "undefined") return DEFAULT_CURRENCY;
    return (
      readStored(APP_STORAGE_KEYS.currency, isAppCurrency) ??
      defaultCurrencyForLocale(
        readStored(APP_STORAGE_KEYS.locale, isAppLocale) ??
          detectLocale(navigator.languages ?? [navigator.language])
      )
    );
  });

  // The account's saved preferences win over the device the first time we
  // see them; afterwards both stay in sync through setLocale/setCurrency.
  useEffect(() => {
    if (!user) return;
    const saved = user as { locale?: string | null; currency?: string | null };
    if (isAppLocale(saved.locale) && saved.locale !== locale) {
      setLocaleState(saved.locale);
      writeStored(APP_STORAGE_KEYS.locale, saved.locale);
    }
    if (isAppCurrency(saved.currency) && saved.currency !== currency) {
      setCurrencyState(saved.currency);
      writeStored(APP_STORAGE_KEYS.currency, saved.currency);
    }
    // Only react to a newly loaded user, not to our own local changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.lang = localeTag(locale);
  }, [locale]);

  const setLocale = useCallback(
    (next: AppLocale) => {
      setLocaleState(next);
      writeStored(APP_STORAGE_KEYS.locale, next);
      if (isAuthenticated) updatePrefs.mutate({ locale: next });
    },
    [isAuthenticated, updatePrefs]
  );

  const setCurrency = useCallback(
    (next: AppCurrency) => {
      setCurrencyState(next);
      writeStored(APP_STORAGE_KEYS.currency, next);
      if (isAuthenticated) updatePrefs.mutate({ currency: next });
    },
    [isAuthenticated, updatePrefs]
  );

  const fx = (fxQuery.data as FxRates | undefined) ?? null;

  const value = useMemo<PrefsValue>(() => {
    const rates = fx ?? FALLBACK_FX;
    const toDisplay = (usd: number | null | undefined) => {
      if (usd == null || !Number.isFinite(usd)) return null;
      return Math.round(usd * (rates.rates[currency] ?? 1) * 100) / 100;
    };
    return {
      locale,
      currency,
      fx,
      setLocale,
      setCurrency,
      toDisplay,
      money: (usd, opts) => formatMoney(toDisplay(usd), currency, locale, opts),
      moneyIn: (amount, cur, opts) => formatMoney(amount, cur, locale, opts),
      secondaryCurrency: currency === "USD" ? "BRL" : "USD",
    };
  }, [locale, currency, fx, setLocale, setCurrency]);

  return (
    <PrefsContext.Provider value={value}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
