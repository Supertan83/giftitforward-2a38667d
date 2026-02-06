import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Webhook, RefreshCw, Clock, Globe, ChevronDown, ChevronUp, Loader2, Copy, Check, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { WebhookActionsPanel } from './WebhookActionsPanel';
import { WebhookDataMapper } from './WebhookDataMapper';
import { WebhookTestingTool } from './WebhookTestingTool';

interface WebhookEvent {
  id: string;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  source_ip: string | null;
  source_identifier: string | null;
  received_at: string;
  processed: boolean;
  created_at: string;
}

interface WebhookEventsViewerProps {
  onBack: () => void;
}

export const WebhookEventsViewer = ({ onBack }: WebhookEventsViewerProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const { signOut } = useAuth();
  const { toast } = useToast();

  const webhookUrl = `https://zrzlzggixuogpxberdxt.supabase.co/functions/v1/webhook-receiver`;

  const { data: events = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookEvent[];
    },
  });

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast({
      title: 'Webhook URL Copied',
      description: 'The webhook URL has been copied to your clipboard',
    });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">GIF (Gift it Forward)</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Webhook Events</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4 md:mb-6 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Webhook URL Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card mb-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
              <Webhook className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-lg mb-1">Webhook Endpoint</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Share this URL with external services. Add <code className="bg-muted px-1 rounded">?source=company_name</code> to track the source.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm font-mono truncate">
                  {webhookUrl}?source=your_company
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copiedUrl ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="testing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="mapper">Data Mapper</TabsTrigger>
            <TabsTrigger value="events">Events Log</TabsTrigger>
          </TabsList>

          <TabsContent value="testing">
            <WebhookTestingTool />
          </TabsContent>

          <TabsContent value="actions">
            <WebhookActionsPanel />
          </TabsContent>

          <TabsContent value="mapper">
            <WebhookDataMapper />
          </TabsContent>

          <TabsContent value="events">
            {/* Events List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card"
            >
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div>
                  <h2 className="font-display font-bold text-lg md:text-xl">Recent Events</h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                    Last 50 webhook events received
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Webhook className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No webhook events received yet.</p>
                  <p className="text-sm mt-1">Events will appear here when external services send data to your webhook URL.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleExpand(event.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center shrink-0">
                            <Webhook className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                Event {event.id.slice(0, 8)}...
                              </span>
                              <Badge variant={event.processed ? 'default' : 'secondary'} className="text-xs">
                                {event.processed ? 'Processed' : 'Pending'}
                              </Badge>
                              {event.source_identifier && (
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {event.source_identifier}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(event.received_at), 'MMM d, yyyy HH:mm:ss')}
                              </span>
                              {event.source_ip && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {event.source_ip}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {expandedId === event.id ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>

                      {expandedId === event.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border bg-muted/30"
                        >
                          <div className="p-4 space-y-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Payload</h4>
                              <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            </div>
                            {event.headers && (
                              <div>
                                <h4 className="text-sm font-medium mb-2">Headers</h4>
                                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-40 overflow-y-auto">
                                  {JSON.stringify(event.headers, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
