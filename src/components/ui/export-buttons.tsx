import { Button } from '@/components/ui/button';

interface ExportButtonsProps {
  onExportCSV: () => void;
  disabled?: boolean;
}

export default function ExportButtons({ onExportCSV, disabled }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onExportCSV} disabled={disabled}>
        Exporter CSV
      </Button>
    </div>
  );
}
