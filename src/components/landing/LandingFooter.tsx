export default function LandingFooter() {
  return (
    <footer className="w-full border-t bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Facture Pro. Tous droits réservés.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground">Confidentialité</a>
            <a href="#" className="hover:text-foreground">Conditions</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
