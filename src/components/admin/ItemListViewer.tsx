import { useState, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ArrowLeft, Download, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useItemTypes } from '@/hooks/useSupabaseData';
interface ItemListViewerProps {
  onBack: () => void;
}
export const ItemListViewer = ({
  onBack
}: ItemListViewerProps) => {
  const {
    data: items = [],
    isLoading
  } = useItemTypes();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const qrRef = useRef<HTMLCanvasElement | null>(null);
  const filtered = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.category?.toLowerCase().includes(search.toLowerCase()) || String(item.externalMaterialId).includes(search));
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
    return <div className="flex items-center justify-center py-20">
        <span className="text-muted-foreground animate-pulse">Loading items...</span>
      </div>;
  }
  return <div className="py-4 md:py-6 px-4 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-display text-xl font-bold">Item List</h1>
        <Badge variant="secondary">{items.length} items</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, category, or material ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Item Table */}
        <div className={selectedItem ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Material ID</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Distributed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => <TableRow key={item.id} className={`cursor-pointer ${selectedItemId === item.id ? 'bg-primary/5' : ''}`} onClick={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{item.category || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{item.externalMaterialId || '—'}</TableCell>
                      <TableCell className="text-right">{item.totalStock.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{item.distributed.toLocaleString()}</TableCell>
                    </TableRow>)}
                  {filtered.length === 0 && <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No items found
                      </TableCell>
                    </TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Detail Panel */}
        {selectedItem && <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {selectedItem.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Material ID</p>
                    
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Stock</p>
                    <p className="font-medium">{selectedItem.totalStock.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Distributed</p>
                    <p className="font-medium">{selectedItem.distributed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Available</p>
                    <p className="font-medium">{(selectedItem.totalStock - selectedItem.distributed).toLocaleString()}</p>
                  </div>
                </div>

                {selectedItem.surplussUrl ? <div className="space-y-3">
                    <div className="flex justify-center bg-white rounded-lg p-4">
                      <QRCodeCanvas ref={qrRef as any} value={selectedItem.surplussUrl} size={180} level="H" includeMargin />
                    </div>
                    <a href={selectedItem.surplussUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline justify-center">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open on Surpluss
                    </a>
                    <Button variant="outline" size="sm" className="w-full" onClick={handleDownloadQR}>
                      <Download className="h-4 w-4 mr-1.5" />
                      Download QR Code
                    </Button>
                  </div> : <p className="text-sm text-muted-foreground text-center py-4">
                    No Surpluss URL available for this item
                  </p>}
              </CardContent>
            </Card>
          </div>}
      </div>
    </div>;
};