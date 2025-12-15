import { cn } from "@/lib/utils";

export function Loader({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent",
        className,
      )}
      aria-label="Chargement"
    />
  );
}

export function LoadingOverlay({ label = "Chargement...", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <Loader />
      <span className="text-sm">{label}</span>
    </div>
  );
}
