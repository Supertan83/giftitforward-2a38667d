import { useState, useMemo, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Download, ExternalLink, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useItemTypesExtended, ExtendedItemType } from '@/hooks/useItemTypesExtended';
import { cn } from '@/lib/utils';

interface ItemListViewerProps {
  onBack: () => void;
}

interface CategoryGroup {
  category: string;
  items: ExtendedItemType[];
  totalQuantity: number;
}

export const ItemListViewer = ({ onBack }: ItemListViewerProps) => {
  const { data: items = [], isLoading } = useItemTypesExtended();
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const filtered = useMemo(() =>
    items.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category?.toLowerCase().includes(search.toLowerCase()) ||
      item.subcategory?.toLowerCase().includes(search.toLowerCase()) ||
      item.donorCompany?.toLowerCase().includes(search.toLowerCase()) ||
      item.marketplaceNames?.toLowerCase().includes(search.toLowerCase()) ||
      String(item.externalMaterialId).includes(search)
    ), [items, search]);

  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Record<string, ExtendedItemType[]> = {};
    filtered.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return Object.entries(groups)
      .map(([category, items]) => ({
        category,
        items,
        totalQuantity: items.reduce((sum, i) => sum + i.totalStock, 0),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
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
        <span className="text-muted-foreground animate-pulse">Loading items...</span>
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6 px-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold">Item List</h1>
        <Badge variant="secondary">{items.length} items</Badge>
        <Badge variant="outline">{categoryGroups.length} categories</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, category, company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {categoryGroups.map(group => {
          const isCollapsed = collapsedCategories.has(group.category);
          return (
            <Card key={group.category} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(group.category)}
                className="w-full flex items-center justify-between px-4 md:px-6 py-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-display font-bold text-base md:text-lg">{group.category}</span>
                  <Badge variant="secondary" className="text-xs">{group.items.length} Items</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Quantity: <span className="font-bold text-primary text-base">{group.totalQuantity.toLocaleString()}</span>
                </div>
              </button>

              {!isCollapsed && (
                <CardContent className="p-0">
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 md:px-6 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-3">Item Name</div>
                    <div className="col-span-2">Donor Company</div>
                    <div className="col-span-2">Marketplace</div>
                    <div className="col-span-1 text-right">Assigned</div>
                    <div className="col-span-1 text-right">Distributed</div>
                    <div className="col-span-1 text-right">Qty Available</div>
                  </div>

                  {group.items.map(item => {
                    const available = item.totalStock - item.distributed;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className="grid grid-cols-12 gap-2 px-4 md:px-6 py-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/30"
                      >
                        <div className="col-span-12 md:col-span-3">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.subcategory || '—'}</p>
                        </div>
                        <div className="col-span-4 md:col-span-2 flex items-center text-sm text-muted-foreground truncate">
                          {item.donorCompany || '—'}
                        </div>
                        <div className="col-span-4 md:col-span-2 flex items-center text-sm text-muted-foreground truncate">
                          {item.marketplaceNames || '—'}
                        </div>
                        <div className="col-span-1 hidden md:flex items-center justify-end text-sm text-muted-foreground">
                          {item.allocatedToMarketplace > 0 ? item.allocatedToMarketplace.toLocaleString() : '—'}
                        </div>
                        <div className="col-span-1 hidden md:flex items-center justify-end text-sm text-muted-foreground">
                          {item.distributed > 0 ? item.distributed.toLocaleString() : '—'}
                        </div>
                        <div className="col-span-4 md:col-span-1 flex items-center justify-end">
                          <span className="font-bold text-sm text-primary">
                            {available.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}

        {categoryGroups.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No items found
            </CardContent>
          </Card>
        )}
      </div>

      {/* Item Detail Dialog */}
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
                  <p className="font-medium">{selectedItem.externalMaterialId || '—'}</p>
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
                  <p className="text-muted-foreground text-xs">Available</p>
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
