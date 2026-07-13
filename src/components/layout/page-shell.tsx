import type { ReactNode } from "react";
import { SiteLayout } from "@/components/site-layout";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

interface PageShellProps {
  title: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
}

/**
 * Standardiseret side-skabelon: SiteLayout + hero-header + indhold.
 * Brug denne på alle undersider så titel, spacing og typografi er ens.
 */
export function PageShell({ title, description, eyebrow, children }: PageShellProps) {
  return (
    <SiteLayout>
      <Section spacing="md">
        <Container>
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              {description}
            </p>
          )}
        </Container>
      </Section>
      {children}
    </SiteLayout>
  );
}
