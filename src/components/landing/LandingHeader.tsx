import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export default function LandingHeader() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold transition-transform hover:scale-105">
            {/* <span className="inline-block h-6 w-6 rounded bg-primary" /> */}
            <img src="./logo2.png" alt="SmartFin Logo" className="h-6 w-6" />
            <span>SmartFin</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {[
              { name: "Accueil", href: "/" },
              { name: "Tarifs", href: "/tarif" },
              { name: "Contact", href: "/contact" },
              { name: "Blog", href: "/blog" },
            ].map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "text-sm font-medium transition-all hover:scale-105",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {loading ? (
              <Button disabled className="ml-2" variant="default">
                Chargement...
              </Button>
            ) : user ? (
              <Button asChild variant="default" className="ml-2">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="default" className="ml-2">
                <Link to="/auth">Connectez-vous</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
