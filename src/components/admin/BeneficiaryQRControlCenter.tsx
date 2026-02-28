import { useState, useCallback } from 'react';
import { ScanLine, Search, ArrowLeft, CreditCard, MapPin, Hash, AlertTriangle, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QRScanner } from '@/components/QRScanner';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CardData {
  id: string;
  unique_id: string;
  status: string;
  credit_balance: number;
  total_items_collected: number;
  marketplace_id: string | null;
  activated_at: string | null;
  created_at: string;
}

interface MarketplaceData {
  id: string;
  name: string;
  beneficiary_credit_limit: number;
  location: string | null;
}

interface TransactionLog {
  id: string;
  type: string;
  credit_change: number;
  timestamp: string;
  item_type: string | null;
}

interface Props {
  onBack: () => void;
}

export const BeneficiaryQRControlCenter = ({ onBack }: Props) => {
  const [searchId, setSearchId] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [card, setCard] = useState<CardData | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplaceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [adjustValue, setAdjustValue] = useState('');
  const { toast } = useToast();

  const lookupCard = useCallback(async (uniqueId: string) => {
    setLoading(true);
    setCard(null);
    setMarketplace(null);
    setTransactions([]);

    try {
      const cleanId = uniqueId.trim();
      
      // Find card
      const { data: cardData, error: cardError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (cardError) throw cardError;
      if (!cardData) {
        toast({ title: 'Not Found', description: `No card found for "${cleanId}"`, variant: 'destructive' });
        setLoading(false);
        return;
      }

      setCard(cardData as CardData);
      setAdjustValue(String(cardData.total_items_collected));

      // Fetch marketplace and transactions in parallel
      const [mpResult, txResult] = await Promise.all([
        cardData.marketplace_id
          ? supabase.from('marketplace_events').select('id, name, beneficiary_credit_limit, location').eq('id', cardData.marketplace_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fetchAllTransactions(cardData.id),
      ]);

      if (mpResult.data) setMarketplace(mpResult.data as MarketplaceData);
      setTransactions(txResult);
    } catch (err: any) {
      toast({ title: 'Lookup Failed', description: err.message || 'Error looking up card', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAllTransactions = async (cardId: string): Promise<TransactionLog[]> => {
    const allTx: TransactionLog[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, type, credit_change, timestamp, item_type')
        .eq('card_id', cardId)
        .order('timestamp', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (data) allTx.push(...(data as TransactionLog[]));
      hasMore = (data?.length ?? 0) === pageSize;
      from += pageSize;
    }
    return allTx;
  };

  const handleSearch = () => {
    if (searchId.trim()) lookupCard(searchId);
  };

  const handleScan = (code: string) => {
    setScannerOpen(false);
    setSearchId(code);
    lookupCard(code);
  };

  const handleAdjust = async () => {
    if (!card) return;
    const newVal = parseInt(adjustValue);
    if (isNaN(newVal) || newVal < 0) {
      toast({ title: 'Invalid', description: 'Enter a valid non-negative number', variant: 'destructive' });
      return;
    }

    setAdjusting(true);
    try {
      const { data, error } = await supabase.rpc('admin_adjust_card_balance', {
        p_card_id: card.id,
        p_new_items_collected: newVal,
      });
      if (error) throw error;

      const result = data as any;
      toast({
        title: 'Balance Adjusted',
        description: `Items: ${result.previous_items} → ${result.new_items} (${result.delta >= 0 ? '+' : ''}${result.delta})`,
      });

      // Refresh card data
      await lookupCard(card.unique_id);
    } catch (err: any) {
      toast({ title: 'Adjustment Failed', description: err.message || 'Failed to adjust balance', variant: 'destructive' });
    } finally {
      setAdjusting(false);
    }
  };

  const creditLimit = marketplace?.beneficiary_credit_limit ?? 15;
  const creditsRemaining = card ? creditLimit - card.total_items_collected : 0;

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-700 border-emerald-200';
      case 'blocked': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'checked_out': return 'bg-amber-500/10 text-amber-700 border-amber-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const txTypeColor = (type: string) => {
    switch (type) {
      case 'Distribution': return 'text-emerald-600';
      case 'Return': return 'text-amber-600';
      case 'Adjustment': return 'text-violet-600';
      case 'CheckIn': return 'text-blue-600';
      case 'CheckOut': return 'text-rose-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="py-4 md:py-6 px-4 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Beneficiary QR Control Center
          </h1>
          <p className="text-sm text-muted-foreground">Look up, inspect, and adjust beneficiary card balances</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setScannerOpen(true)} className="shrink-0 gap-2">
              <ScanLine className="h-4 w-4" /> Scan QR
            </Button>
            <Input
              placeholder="Enter QR ID (e.g. QR-MLS1ZOLO-X382)"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!searchId.trim() || loading} className="shrink-0 gap-2">
              <Search className="h-4 w-4" /> Go
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-8 text-muted-foreground">Looking up card...</div>
      )}

      {card && !loading && (
        <>
          {/* Card Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Card Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Unique ID</span>
                  <p className="font-mono font-semibold">{card.unique_id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div><Badge className={statusColor(card.status)}>{card.status}</Badge></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Marketplace</span>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {marketplace?.name || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Items Collected</span>
                  <p className="font-bold text-lg">
                    {card.total_items_collected} <span className="text-muted-foreground font-normal text-sm">/ {creditLimit}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Credits Remaining: <strong className={creditsRemaining <= 0 ? 'text-destructive' : 'text-emerald-600'}>{creditsRemaining}</strong></span>
                {creditsRemaining <= 0 && (
                  <Badge variant="destructive" className="ml-auto text-xs">Limit Reached</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Adjust Balance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Adjust Items Collected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">New items collected value</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={creditLimit}
                      value={adjustValue}
                      onChange={(e) => setAdjustValue(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">/ {creditLimit}</span>
                  </div>
                </div>
                <Button
                  onClick={handleAdjust}
                  disabled={adjusting || adjustValue === String(card.total_items_collected)}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {adjusting ? 'Saving...' : 'Save Adjustment'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scan Item Logs */}
          <Card>
            <Accordion type="single" collapsible defaultValue="logs">
              <AccordionItem value="logs" className="border-0">
                <CardHeader className="pb-0">
                  <AccordionTrigger className="py-0 hover:no-underline">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Hash className="h-4 w-4 text-primary" />
                      All Scan Item Logs ({transactions.length} total)
                    </CardTitle>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                  <CardContent className="pt-3">
                    {transactions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No transactions found</p>
                    ) : (
                      <div className="max-h-[400px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">#</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead className="text-right">Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.map((tx, idx) => (
                              <TableRow key={tx.id}>
                                <TableCell className="text-muted-foreground text-xs">{transactions.length - idx}</TableCell>
                                <TableCell>
                                  <span className={`font-medium text-xs ${txTypeColor(tx.type)}`}>{tx.type}</span>
                                </TableCell>
                                <TableCell className="text-xs font-mono">
                                  {format(new Date(tx.timestamp), 'MMM d, HH:mm:ss')}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {tx.credit_change > 0 ? `+${tx.credit_change}` : tx.credit_change === 0 ? '0' : tx.credit_change}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </>
      )}

      <QRScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan Beneficiary QR"
      />
    </div>
  );
};
