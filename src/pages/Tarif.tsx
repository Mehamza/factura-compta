import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Gratuit",
    price: "0",
    period: "pour toujours",
    description: "Pour démarrer votre activité",
    features: [
      "10 factures / mois",
      "5 clients",
      "Export PDF",
      "1 utilisateur",
    ],
    cta: "Commencer gratuitement",
    popular: false,
  },
  {
    name: "Pro",
    price: "300",
    period: "/ an",
    description: "Pour les PME en croissance",
    features: [
      "Factures illimitées",
      "Clients illimités",
      "Export PDF & Excel",
      "Rapports avancés",
      "Gestion de stock",
      "Support prioritaire",
    ],
    cta: "Essai gratuit 14 jours",
    popular: true,
  },
  {
    name: "Business",
    price: "600",
    period: "/ an",
    description: "Pour les entreprises établies",
    features: [
      "Tout dans Pro",
      "Multi-utilisateurs (5)",
      "API d'intégration",
      "Comptabilité avancée",
      "Support dédié",
      "Formation incluse",
    ],
    cta: "Contacter les ventes",
    popular: false,
  },
];

export default function Tarif() {
  return (
    <section className="bg-muted/30 py-16 sm:py-24 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Tarifs simples et transparents</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choisissez le plan qui correspond à vos besoins
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`relative opacity-0 animate-fade-in-up ${
                plan.popular ? "border-primary shadow-lg scale-105" : ""
              }`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Le plus populaire
                </Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground"> TND {plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link to="/signup">{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
