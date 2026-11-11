import { PlanCatalog } from '@/components/subscriptions/PlanCatalog';

export default function Tarif() {
  return (
    <section className="min-h-screen bg-muted/30 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold">Tarifs simples et transparents</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Choisissez votre plan. L’activation est faite après vérification de votre paiement.
          </p>
        </div>
        <PlanCatalog />
      </div>
    </section>
  );
}
