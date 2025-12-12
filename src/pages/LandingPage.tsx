import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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
              <div className="aspect-video w-full rounded-lg border bg-card shadow-sm flex items-center justify-center">
                <div className="text-center p-6">
                  <p className="text-sm text-muted-foreground">
                    Aperçu du tableau de bord
                  </p>
                  <div className="mt-3 h-24 w-48 rounded-md bg-primary/10" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold">Gestion des factures</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Créez des factures professionnelles et suivez les paiements en temps réel.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold">Clients & Fournisseurs</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Centralisez vos contacts et gardez l’historique de vos opérations.
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
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
