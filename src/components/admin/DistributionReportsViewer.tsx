import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileText, Check, AlertCircle, Loader2, RefreshCw, ExternalLink, Server, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface DistributionReport {
  id: string;
  allocation_id: number;
  environment: string;
  marketplace_external_id: number | null;
  distributed_total: number;
  allocated_total: number;
  api_response_status: number | null;
  api_response_body: any;
  reported_at: string;
  created_at: string;
}

export const DistributionReportsViewer = () => {
  const [environment, setEnvironment] = useState<'staging' | 'production' | 'all'>('all');
  const [selectedReport, setSelectedReport] = useState<DistributionReport | null>(null);

  const { data: reports, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['distribution_reports', environment],
    queryFn: async (): Promise<DistributionReport[]> => {
      let query = supabase
        .from('surpluss_distribution_reports')
        .select('*')
        .order('reported_at', { ascending: false })
        .limit(100);

      if (environment !== 'all') {
        query = query.eq('environment', environment);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusBadge = (status: number | null) => {
    if (status === null) return <Badge variant="outline">Unknown</Badge>;
    if (status >= 200 && status < 300) {
      return (
        <Badge variant="default" className="bg-emerald-500">
          <Check className="w-3 h-3 mr-1" />
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const successCount = reports?.filter(r => r.api_response_status && r.api_response_status >= 200 && r.api_response_status < 300).length || 0;
  const failedCount = reports?.filter(r => r.api_response_status && (r.api_response_status < 200 || r.api_response_status >= 300)).length || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Distribution Reports History
              </CardTitle>
              <CardDescription>
                View all distribution reports sent to Surpluss API
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Filter:</Label>
                <Select value={environment} onValueChange={(v) => setEnvironment(v as 'staging' | 'production' | 'all')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          {reports && reports.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-xl font-bold">{reports.length}</div>
                <div className="text-xs text-muted-foreground">Total Reports</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <div className="text-xl font-bold text-emerald-600">{successCount}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <div className="text-xl font-bold text-red-600">{failedCount}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports && reports.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation ID</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Distributed</TableHead>
                    <TableHead>Allocated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reported At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Badge variant="outline">{report.allocation_id}</Badge>
                      </TableCell>
                      <TableCell>
                        {report.marketplace_external_id ? (
                          <Badge variant="secondary">{report.marketplace_external_id}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={report.environment === 'production' 
                            ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400' 
                            : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                          }
                        >
                          {report.environment === 'production' ? (
                            <Cloud className="w-3 h-3 mr-1" />
                          ) : (
                            <Server className="w-3 h-3 mr-1" />
                          )}
                          {report.environment}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{report.distributed_total.toLocaleString()}</TableCell>
                      <TableCell className="font-mono">{report.allocated_total.toLocaleString()}</TableCell>
                      <TableCell>{getStatusBadge(report.api_response_status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(report.reported_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedReport(report)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
              <p className="text-muted-foreground">
                Distribution reports will appear here after you send them to Surpluss
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription>
              Allocation {selectedReport?.allocation_id} - {selectedReport?.environment}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Distributed</Label>
                <p className="text-lg font-semibold">{selectedReport?.distributed_total.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Allocated</Label>
                <p className="text-lg font-semibold">{selectedReport?.allocated_total.toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">API Status</Label>
                <div className="mt-1">
                  {selectedReport && getStatusBadge(selectedReport.api_response_status)}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Reported At</Label>
                <p className="text-sm">
                  {selectedReport && format(new Date(selectedReport.reported_at), 'PPpp')}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">API Response</Label>
              <ScrollArea className="h-60 mt-2">
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
                  {JSON.stringify(selectedReport?.api_response_body, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
