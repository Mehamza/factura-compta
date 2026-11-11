import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { 
  FileText, Users, FolderOpen, BarChart3, CreditCard, Shield, 
  Mail, Phone, MapPin, Calendar, TrendingUp, ArrowRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlanCatalog } from "@/components/subscriptions/PlanCatalog";

const blogPosts = [
  {
    title: "Comment optimiser sa facturation en 2025",
    excerpt: "Découvrez les meilleures pratiques pour automatiser et améliorer votre processus de facturation.",
    date: "15 Déc 2024",
    category: "Conseils",
    image: "📊",
  },
  {
    title: "Les obligations fiscales des PME tunisiennes",
    excerpt: "Guide complet sur les déclarations TVA, timbre fiscal et conformité fiscale en Tunisie.",
    date: "10 Déc 2024",
    category: "Fiscalité",
    image: "📋",
  },
  {
    title: "Digitaliser sa comptabilité : par où commencer ?",
    excerpt: "Les étapes clés pour passer d'une gestion papier à un système 100% numérique.",
    date: "5 Déc 2024",
    category: "Digital",
    image: "💻",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="animate-fade-in">
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
                Facturation simple et efficace pour les PME tunisiennes
              </h1>
              <p className="mt-4 text-lg text-muted-foreground opacity-0 animate-fade-in-up [animation-delay:200ms]">
                Créez, gérez et envoyez vos factures en quelques clics.
                Suivez vos clients et fournisseurs, et gardez vos documents
                organisés — tout en un seul endroit.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 opacity-0 animate-fade-in-up [animation-delay:400ms]">
                <Button asChild size="lg" className="transition-transform hover:scale-105">
                  <Link to="/dashboard">Commencer gratuitement</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="transition-transform hover:scale-105">
                  <Link to="tarif">Voir les tarifs</Link>
                </Button>
              </div>
            </div>
            
            {/* Dashboard Mock - Realistic */}
            <div className="relative opacity-0 animate-slide-in-right [animation-delay:300ms]">
              <div className="aspect-[4/3] w-full rounded-xl border bg-card shadow-2xl overflow-hidden animate-float">
                <div className="h-full flex flex-col">
                  {/* App Header */}
                  <div className="h-10 bg-primary/10 border-b flex items-center px-4 gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold">SmartFin</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 flex">
                    {/* Sidebar */}
                    <div className="w-20 border-r bg-muted/30 p-2 space-y-2">
                      <div className="h-8 w-full rounded-md bg-primary/20 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="h-8 w-full rounded-md bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="h-8 w-full rounded-md bg-muted flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="h-8 w-full rounded-md bg-muted flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 p-4 space-y-4">
                      {/* Stats Cards */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="text-xs text-muted-foreground">Clients</div>
                          <div className="text-lg font-bold text-primary">127</div>
                        </div>
                        <div className="p-2 rounded-lg bg-accent">
                          <div className="text-xs text-muted-foreground">Factures</div>
                          <div className="text-lg font-bold">45</div>
                        </div>
                        <div className="p-2 rounded-lg bg-accent">
                          <div className="text-xs text-muted-foreground">Ce mois</div>
                          <div className="text-lg font-bold text-green-600">12.5K</div>
                        </div>
                        <div className="p-2 rounded-lg bg-accent">
                          <div className="text-xs text-muted-foreground">En attente</div>
                          <div className="text-lg font-bold text-orange-500">3.2K</div>
                        </div>
                      </div>
                      
                      {/* Chart Mock */}
                      <div className="flex-1 rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">Évolution CA</span>
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="flex items-end gap-1 h-16">
                          {[40, 65, 45, 80, 55, 90, 70, 95, 85, 75, 100, 88].map((h, i) => (
                            <div 
                              key={i} 
                              className="flex-1 bg-primary/60 rounded-t transition-all hover:bg-primary"
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Recent Invoices */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium mb-2">Factures récentes</div>
                        {[
                          { num: 'FAC-2024-045', client: 'ABC Corp', status: 'paid' },
                          { num: 'FAC-2024-044', client: 'XYZ SARL', status: 'pending' },
                          { num: 'FAC-2024-043', client: 'Tech Plus', status: 'paid' },
                        ].map((inv, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
                            <span className="font-mono">{inv.num}</span>
                            <span className="text-muted-foreground">{inv.client}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              (inv as any).status === 'paid' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {(inv as any).status === 'paid' ? 'Payée' : 'En attente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "Gestion des factures", desc: "Créez des factures professionnelles et suivez les paiements en temps réel." },
              { icon: Users, title: "Clients & Fournisseurs", desc: "Centralisez vos contacts et gardez l'historique de vos opérations." },
              { icon: FolderOpen, title: "Documents organisés", desc: "Rangez vos devis, factures et pièces jointes en un seul endroit." },
            ].map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6 opacity-0 animate-fade-in-up transition-all hover:shadow-lg hover:-translate-y-1"
                style={{ animationDelay: `${700 + index * 150}ms` }}
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="tarifs" className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Tarifs simples et transparents</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Choisissez le plan qui correspond à vos besoins
              </p>
            </div>

            <PlanCatalog />
          </div>
        </section>

        {/* Blog Section */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl font-bold">Actualités & Conseils</h2>
                <p className="mt-2 text-muted-foreground">
                  Restez informé des dernières tendances en gestion d'entreprise
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/blog" className="hidden sm:flex items-center gap-2">
                  Voir tous les articles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {blogPosts.map((post, index) => (
                <Card 
                  key={post.title} 
                  className="opacity-0 animate-fade-in-up overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="h-40 bg-muted flex items-center justify-center text-6xl">
                    {post.image}
                  </div>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{post.category}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {post.date}
                      </span>
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{post.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{post.excerpt}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center sm:hidden">
              <Button variant="outline" asChild>
                <Link to="/blog" className="flex items-center gap-2">
                  Voir tous les articles
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h2 className="text-3xl font-bold">Contactez-nous</h2>
                <p className="mt-4 text-muted-foreground">
                  Une question ? Notre équipe est là pour vous aider.
                </p>

                <div className="mt-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Email</div>
                      <div className="text-muted-foreground">contact@SmartFin.tn</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Téléphone</div>
                      <div className="text-muted-foreground">+216 95 127 301</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">Adresse</div>
                      <div className="text-muted-foreground">
                        Rue de la Liberté, Sbeitla<br />
                        1250 Kasserine, Tunisie
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Envoyez-nous un message</CardTitle>
                  <CardDescription>
                    Nous vous répondrons dans les plus brefs délais
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom</Label>
                      <Input id="name" placeholder="Votre nom" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" placeholder="foulen.Benfoulen@email.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Sujet</Label>
                    <Input id="subject" placeholder="Comment pouvons-nous vous aider ?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea 
                      id="message" 
                      placeholder="Décrivez votre demande..." 
                      rows={4}
                    />
                  </div>
                  <Button className="w-full">
                    Envoyer le message
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

    </div>
  );
}
