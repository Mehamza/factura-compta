import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FileText, Users, FolderOpen, BarChart3, CreditCard, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
                Facturation simple et efficace pour les PME tunisiennes
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Créez, gérez et envoyez vos factures en quelques clics.
                Suivez vos clients et fournisseurs, et gardez vos documents
                organisés — tout en un seul endroit.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/signup">Commencer gratuitement</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/tarif">Voir les tarifs</Link>
                </Button>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Sans carte bancaire. Annulation à tout moment.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-video w-full rounded-lg border bg-card shadow-lg overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Mini header */}
                  <div className="h-8 bg-primary/10 border-b flex items-center px-3 gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold">Facture Pro</span>
                  </div>
                  {/* Content */}
                  <div className="flex-1 flex">
                    {/* Mini sidebar */}
                    <div className="w-16 border-r bg-muted/30 p-2 space-y-2">
                      <div className="h-6 w-full rounded bg-primary/20" />
                      <div className="h-6 w-full rounded bg-muted" />
                      <div className="h-6 w-full rounded bg-muted" />
                      <div className="h-6 w-full rounded bg-muted" />
                    </div>
                    {/* Main area */}
                    <div className="flex-1 p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-12 rounded bg-primary/10 flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-primary/60" />
                        </div>
                        <div className="h-12 rounded bg-accent flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="h-12 rounded bg-accent flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="h-16 rounded bg-muted/50" />
                      <div className="h-8 rounded bg-muted/30" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border bg-card p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Gestion des factures</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Créez des factures professionnelles et suivez les paiements en temps réel.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Clients & Fournisseurs</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Centralisez vos contacts et gardez l'historique de vos opérations.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold">Documents organisés</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Rangez vos devis, factures et pièces jointes en un seul endroit.
              </p>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
