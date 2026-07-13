import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { NovyxMark } from "@/components/brand/logo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6"><NovyxMark className="h-10 w-10" /></div>
        <div className="text-[10px] tracking-[0.24em] text-fg-muted uppercase">Error 404</div>
        <h1 className="mt-3 text-4xl font-semibold text-fg">Siden findes ikke</h1>
        <p className="mt-3 text-sm text-fg-muted">
          Den URL du prøvede findes ikke længere — eller har aldrig eksisteret.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            Tilbage til forsiden
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6"><NovyxMark className="h-10 w-10" /></div>
        <h1 className="text-xl font-semibold text-fg">Der opstod en fejl</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Prøv at genindlæse siden — hvis fejlen fortsætter, vender vi tilbage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-[var(--accent-hover)]"
          >
            Prøv igen
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-card"
          >
            Forside
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0F1117" },
      { title: "NOVYX — Premium Windows Performance" },
      { name: "description", content: "NOVYX er et premium Windows-optimeringsprogram. Kør ét-klik boost, ryd systemet og få mere ud af din PC — bygget til gamere og power-users." },
      { name: "author", content: "NOVYX" },
      { property: "og:site_name", content: "NOVYX" },
      { property: "og:title", content: "NOVYX — Premium Windows Performance" },
      { property: "og:description", content: "NOVYX er et premium Windows-optimeringsprogram. Kør ét-klik boost, ryd systemet og få mere ud af din PC — bygget til gamere og power-users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NOVYX — Premium Windows Performance" },
      { name: "twitter:description", content: "NOVYX er et premium Windows-optimeringsprogram. Kør ét-klik boost, ryd systemet og få mere ud af din PC — bygget til gamere og power-users." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3738f6fa-7ca3-403a-83e5-d77bb6b41c6e/id-preview-a94e5194--8cf547d5-795d-4a18-b736-cf59ca480f39.lovable.app-1783584318103.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3738f6fa-7ca3-403a-83e5-d77bb6b41c6e/id-preview-a94e5194--8cf547d5-795d-4a18-b736-cf59ca480f39.lovable.app-1783584318103.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="da" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
