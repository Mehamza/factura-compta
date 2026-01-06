import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

interface TimeSeriesData {
  month: string;
  invoices: number;
  payments: number;
  companies: number;
}

interface GlobalChartsProps {
  timeSeriesData: TimeSeriesData[];
  loading?: boolean;
}

export function GlobalCharts({ timeSeriesData, loading }: GlobalChartsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-40 bg-muted animate-pulse rounded" />
              <div className="h-4 w-60 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-muted/50 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Invoices & Payments Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Factures & Paiements</CardTitle>
          <CardDescription>Évolution mensuelle des factures et paiements</CardDescription>
        </CardHeader>
        <CardContent>
          {timeSeriesData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Bar 
                    dataKey="invoices" 
                    name="Factures" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="payments" 
                    name="Paiements" 
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Pas de données disponibles
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Signups Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Inscriptions Entreprises</CardTitle>
          <CardDescription>Évolution mensuelle des nouvelles entreprises</CardDescription>
        </CardHeader>
        <CardContent>
          {timeSeriesData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="companies" 
                    name="Nouvelles entreprises"
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-3))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Pas de données disponibles
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
