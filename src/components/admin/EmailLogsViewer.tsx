import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, AlertCircle, CheckCircle, RefreshCw, Copy, ChevronDown, ChevronRight, Filter, RotateCcw, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  pending_volunteer_id: string | null;
  email_type: string;
  provider: string;
  recipient_email: string;
  success: boolean;
  error_message: string | null;
  request_payload: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  created_at: string;
}

interface EmailLogsViewerProps {
  onBack: () => void;
}

export const EmailLogsViewer = ({ onBack }: EmailLogsViewerProps) => {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['email-logs', filterProvider, filterStatus, filterType],
    queryFn: async () => {
      let query = supabase
        .from('email_send_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterProvider !== 'all') {
        query = query.eq('provider', filterProvider);
      }
      if (filterStatus !== 'all') {
        query = query.eq('success', filterStatus === 'success');
      }
      if (filterType !== 'all') {
        query = query.eq('email_type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailLog[];
    }
  });

  // Pagination
  const pagination = usePagination(logs, { defaultPageSize: 25 });
  
  // Reset to page 1 when filters change
  useEffect(() => {
    pagination.setCurrentPage(1);
  }, [filterProvider, filterStatus, filterType]);

  const successCount = logs.filter(l => l.success).length;
  const failedCount = logs.filter(l => !l.success).length;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`
    });
  };

  const handleRetryEmail = async (log: EmailLog) => {
    if (!log.pending_volunteer_id) {
      toast({
        title: 'Cannot Retry',
        description: 'No volunteer ID associated with this email log',
        variant: 'destructive'
      });
      return;
    }

    setRetryingId(log.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('resend-welcome-email', {
        body: {
          pending_volunteer_id: log.pending_volunteer_id,
          email_type: log.email_type,
          force_resend: true
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Email Sent',
          description: `Successfully resent ${log.email_type} email to ${log.recipient_email} via ${data.provider}`
        });
        // Refresh logs to show the new attempt
        queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      } else {
        throw new Error(data?.error || 'Failed to resend email');
      }
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: error instanceof Error ? error.message : 'Failed to resend email',
        variant: 'destructive'
      });
    } finally {
      setRetryingId(null);
    }
  };

  const uniqueProviders = [...new Set(logs.map(l => l.provider))];
  const uniqueTypes = [...new Set(logs.map(l => l.email_type))];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              <h1 className="font-display font-bold text-lg">Email Send Logs</h1>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={isRefetching}
              className="ml-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 px-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{logs.length}</div>
              <div className="text-sm text-muted-foreground">Total Logs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="py-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <CardTitle className="text-sm">Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex gap-4 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Provider</label>
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {uniqueProviders.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Email Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Email Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No email logs found. Emails will be logged here after they are sent.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {pagination.paginatedItems.map((log) => (
                    <Collapsible
                      key={log.id}
                      open={expandedLog === log.id}
                      onOpenChange={(open) => setExpandedLog(open ? log.id : null)}
                    >
                      <div className={`border rounded-lg ${log.success ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                        <CollapsibleTrigger asChild>
                          <button className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/30 transition-colors">
                            {log.success ? (
                              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">{log.recipient_email}</span>
                                <Badge variant="outline" className="text-xs">{log.email_type}</Badge>
                                <Badge variant="secondary" className="text-xs">{log.provider}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                              </div>
                              {!log.success && log.error_message && (
                                <div className="text-sm text-red-600 mt-1 truncate">
                                  {log.error_message}
                                </div>
                              )}
                            </div>
                            {expandedLog === log.id ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 space-y-4 border-t pt-4">
                            {/* Retry Button for failed emails */}
                            {!log.success && log.pending_volunteer_id && (
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetryEmail(log);
                                  }}
                                  disabled={retryingId === log.id}
                                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                >
                                  {retryingId === log.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                  )}
                                  {retryingId === log.id ? 'Sending...' : 'Retry Email'}
                                </Button>
                              </div>
                            )}
                            
                            {log.error_message && (
                              <div>
                                <div className="text-sm font-medium text-red-600 mb-1">Error Message</div>
                                <div className="bg-red-100 p-3 rounded text-sm text-red-800">
                                  {log.error_message}
                                </div>
                              </div>
                            )}
                            
                            {log.request_payload && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">Request Payload</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(JSON.stringify(log.request_payload, null, 2), 'Request payload')}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <ScrollArea className="h-[200px]">
                                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.request_payload, null, 2)}
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}
                            
                            {log.response_data && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium">Response Data</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(JSON.stringify(log.response_data, null, 2), 'Response data')}
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy
                                  </Button>
                                </div>
                                <ScrollArea className="h-[200px]">
                                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(log.response_data, null, 2)}
                                  </pre>
                                </ScrollArea>
                              </div>
                            )}

                            {log.pending_volunteer_id && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">Volunteer ID: </span>
                                <code className="bg-muted px-2 py-1 rounded text-xs">{log.pending_volunteer_id}</code>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  pageSize={pagination.pageSize}
                  pageSizeOptions={pagination.pageSizeOptions}
                  canGoNext={pagination.canGoNext}
                  canGoPrevious={pagination.canGoPrevious}
                  onPageChange={pagination.setCurrentPage}
                  onPageSizeChange={pagination.setPageSize}
                  onGoToFirst={pagination.goToFirstPage}
                  onGoToLast={pagination.goToLastPage}
                  onGoToNext={pagination.goToNextPage}
                  onGoToPrevious={pagination.goToPreviousPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
