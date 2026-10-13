import { useLocation } from "wouter";
import { useT } from "../i18n";
import { track } from "../analytics";

/**
 * The only sign-in prompt in the app. It appears where saving to the cloud
 * matters (collection, portfolio, alerts), never before the first scan.
 */
export function SignInCard({
  title,
  body,
  cta,
  next,
}: {
  title: string;
  body: string;
  cta?: string;
  next?: string;
}) {
  const t = useT();
  const [location] = useLocation();
  const target = `/login?next=${encodeURIComponent(next ?? location)}`;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <a
        href={target}
        onClick={() => track("signup_prompt_clicked", { from: location })}
        className="mt-4 flex h-12 items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground active:scale-[0.98] transition-transform"
      >
        {cta ?? t("Create account")}
      </a>
      <a
        href={target}
        className="mt-2 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("Sign in")}
      </a>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
