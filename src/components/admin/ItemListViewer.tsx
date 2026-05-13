import { useState, useMemo, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Download, ExternalLink, Search, ChevronDown, ChevronRight, Package, CheckCircle2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useItemTypesExtended, ExtendedItemType } from '@/hooks/useItemTypesExtended';

interface ItemListViewerProps {
  onBack: () => void;
}

interface CompanyGroup {
  company: string;
  items: ExtendedItemType[];
  totalRemaining: number;
  totalDistributed: number;
}

const UNASSIGNED = 'Unassigned Donor';

const getDonorRemaining = (item: ExtendedItemType) => Math.max(item.totalStock - item.allocatedToMarketplace, 0);

export const ItemListViewer = ({ onBack }: ItemListViewerProps) => {
  const { data: items = [], isLoading } = useItemTypesExtended();
  const [search, setSearch] = useState('');
  const [onlyRemaining, setOnlyRemaining] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      const remaining = getDonorRemaining(item);
      if (onlyRemaining && remaining <= 0) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.subcategory?.toLowerCase().includes(q) ||
        item.donorCompany?.toLowerCase().includes(q) ||
        item.marketplaceNames?.toLowerCase().includes(q) ||
        String(item.externalMaterialId ?? '').includes(q)
      );
    });
  }, [items, search, onlyRemaining]);

  const companyGroups = useMemo((): CompanyGroup[] => {
    const groups: Record<string, ExtendedItemType[]> = {};
    filtered.forEach(item => {
      const key = item.donorCompany || UNASSIGNED;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups)
      .map(([company, items]) => {
        const sorted = [...items].sort(
          (a, b) => getDonorRemaining(b) - getDonorRemaining(a)
        );
        return {
          company,
          items: sorted,
          totalRemaining: sorted.reduce((s, i) => s + getDonorRemaining(i), 0),
          totalDistributed: sorted.reduce((s, i) => s + i.distributed, 0),
        };
      })
      .sort((a, b) => {
        // Unassigned at bottom, otherwise by remaining desc
        if (a.company === UNASSIGNED) return 1;
        if (b.company === UNASSIGNED) return -1;
        return b.totalRemaining - a.totalRemaining;
      });
  }, [filtered]);

  const toggle = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectedItem = items.find(i => i.id === selectedItemId);

  const handleDownloadQR = useCallback(() => {
    const canvas = qrRef.current;
    if (!canvas || !selectedItem) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${selectedItem.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
  }, [selectedItem]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground animate-pulse">Loading inventory...</span>
      </div>
    );
  }

  const grandRemaining = companyGroups.reduce((s, g) => s + g.totalRemaining, 0);
  const totalReceived = items.reduce((s, i) => s + i.totalStock, 0);
  const totalAllocated = items.reduce((s, i) => s + i.allocatedToMarketplace, 0);
  const totalDistributed = items.reduce((s, i) => s + i.distributed, 0);

  return (
    <div className="py-4 md:py-6 px-2 md:px-4 mx-auto space-y-4 max-w-full overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold">Mini Inventory</h1>
        <Badge variant="secondary">{filtered.length} items</Badge>
        <Badge variant="outline">{companyGroups.length} donors</Badge>
        <Badge className="bg-primary/10 text-primary border-primary/20" variant="outline">
          Total Remaining: {grandRemaining.toLocaleString()}
        </Badge>
      </div>

      <Card className="overflow-hidden border-primary/20 shadow-card">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Items Donated</p>
              <p className="font-display text-3xl md:text-4xl font-bold text-foreground mt-1">
                {totalReceived.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Items received</p>
            </div>
            <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Package className="h-6 w-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-2 text-primary">
                <Archive className="h-4 w-4" />
                <span className="text-xl font-bold">{totalAllocated.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Number of items allocated</p>
            </div>
            <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3">
              <div className="flex items-center gap-2 text-accent-foreground">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xl font-bold">{totalDistributed.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Number of items distributed</p>
            </div>
            <div className="rounded-lg border border-secondary bg-secondary/50 px-4 py-3">
              <div className="flex items-center gap-2 text-foreground">
                <Package className="h-4 w-4" />
                <span className="text-xl font-bold">{grandRemaining.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Number of items remaining</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, material ID, donor, marketplace..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-remaining" checked={onlyRemaining} onCheckedChange={setOnlyRemaining} />
          <Label htmlFor="only-remaining" className="text-sm cursor-pointer">
            Only items with remaining stock
          </Label>
        </div>
      </div>

      <div className="space-y-3">
        {companyGroups.map(group => {
          const isCollapsed = collapsed.has(group.company);
          return (
            <Card key={group.company} className="overflow-hidden">
              <button
                onClick={() => toggle(group.company)}
                className="w-full flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isCollapsed
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                  <span className="font-display font-bold text-base md:text-lg truncate">{group.company}</span>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">{group.items.length} items</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
                  <span className="hidden md:inline">Distributed: <span className="font-semibold text-foreground">{group.totalDistributed.toLocaleString()}</span></span>
                  <span>Remaining: <span className="font-bold text-primary text-base">{group.totalRemaining.toLocaleString()}</span></span>
                </div>
              </button>

              {!isCollapsed && (
                <CardContent className="p-0">
                  {/* Mobile */}
                  <div className="md:hidden divide-y divide-border">
                    {group.items.map(item => {
                      const remaining = item.totalStock - item.distributed;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className="w-full p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                <span className="font-mono">ID: {item.externalMaterialId ?? '—'}</span>
                                {item.category && <> · {item.category}</>}
                              </p>
                            </div>
                            <span className="font-bold text-primary text-sm flex-shrink-0">{remaining.toLocaleString()}</span>
                          </div>
                          {item.marketplaceNames && (
                            <p className="text-xs text-muted-foreground truncate">MP: {item.marketplaceNames}</p>
                          )}
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Assigned: {item.allocatedToMarketplace > 0 ? item.allocatedToMarketplace.toLocaleString() : '—'}</span>
                            <span>Distributed: {item.distributed > 0 ? item.distributed.toLocaleString() : '—'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm table-fixed">
                      <thead>
                        <tr className="border-b bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <th className="text-left px-4 lg:px-6 py-2 w-[10%]">Material ID</th>
                          <th className="text-left px-3 py-2 w-[28%]">Item Name</th>
                          <th className="text-left px-3 py-2 w-[22%]">Marketplace</th>
                          <th className="text-right px-3 py-2 w-[12%]">Assigned</th>
                          <th className="text-right px-3 py-2 w-[12%]">Distributed</th>
                          <th className="text-right px-4 lg:px-6 py-2 w-[16%]">Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => {
                          const remaining = item.totalStock - item.distributed;
                          return (
                            <tr
                              key={item.id}
                              onClick={() => setSelectedItemId(item.id)}
                              className="border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/30"
                            >
                              <td className="px-4 lg:px-6 py-3 font-mono font-semibold">
                                {item.externalMaterialId ?? '—'}
                              </td>
                              <td className="px-3 py-3">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.category || '—'}{item.subcategory ? ` · ${item.subcategory}` : ''}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-muted-foreground truncate">{item.marketplaceNames || '—'}</td>
                              <td className="px-3 py-3 text-right text-muted-foreground">
                                {item.allocatedToMarketplace > 0 ? item.allocatedToMarketplace.toLocaleString() : '—'}
                              </td>
                              <td className="px-3 py-3 text-right text-muted-foreground">
                                {item.distributed > 0 ? item.distributed.toLocaleString() : '—'}
                              </td>
                              <td className="px-4 lg:px-6 py-3 text-right">
                                <span className={`font-bold ${remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                  {remaining.toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {companyGroups.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No items found
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => { if (!open) setSelectedItemId(null); }}>
        <DialogContent className="w-fit max-w-[90vw] max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedItem.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{selectedItem.category || '—'}</p>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                <div>
                  <p className="text-muted-foreground text-xs">Subcategory</p>
                  <p className="font-medium">{selectedItem.subcategory || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Material ID</p>
                  <p className="font-medium font-mono">{selectedItem.externalMaterialId || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Donor Company</p>
                  <p className="font-medium">{selectedItem.donorCompany || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Marketplace</p>
                  <p className="font-medium">{selectedItem.marketplaceNames || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Total Stock</p>
                  <p className="font-medium">{selectedItem.totalStock.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Remaining</p>
                  <p className="font-medium text-primary">{(selectedItem.totalStock - selectedItem.distributed).toLocaleString()}</p>
                </div>
              </div>

              {selectedItem.surplussUrl ? (
                <div className="space-y-3 mt-2">
                  <div className="flex justify-center bg-white rounded-lg p-3">
                    <QRCodeCanvas
                      ref={qrRef as any}
                      value={selectedItem.surplussUrl}
                      size={160}
                      level="H"
                      includeMargin
                    />
                  </div>
                  <a
                    href={selectedItem.surplussUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline justify-center"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open on Surpluss
                  </a>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadQR}>
                    <Download className="h-4 w-4 mr-1.5" />
                    Download QR
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No Surpluss URL available
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
