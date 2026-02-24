import { useMemo } from 'react';
import { ChevronDown, ChevronRight, Eye, XCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { QRCard } from '@/types';

type BatchGroup = [string, QRCard[]];

interface RegisteredCardsListProps {
  batchGroups: BatchGroup[];
  expandedBatches: Set<string>;
  selectedCards: Set<string>;
  isUnregistering: boolean;
  defaultCreditLimit?: number;
  toggleBatchExpand: (batchId: string) => void;
  toggleBatchSelectAll: (batchCards: QRCard[]) => void;
  toggleCardSelection: (uniqueId: string) => void;
  handlePreviewCard: (uniqueId: string) => void;
  setCardToUnregister: (uniqueId: string) => void;
}

export const RegisteredCardsList = ({
  batchGroups,
  expandedBatches,
  selectedCards,
  isUnregistering,
  defaultCreditLimit = 15,
  toggleBatchExpand,
  toggleBatchSelectAll,
  toggleCardSelection,
  handlePreviewCard,
  setCardToUnregister,
}: RegisteredCardsListProps) => {
  const pagination = usePagination(batchGroups, {
    defaultPageSize: 10,
    pageSizeOptions: [10, 25, 50],
  });

  return (
    <div className="space-y-2">
      <div className="max-h-[400px] overflow-y-auto space-y-2">
        {pagination.paginatedItems.map(([batchId, batchCards]) => {
          const isExpanded = expandedBatches.has(batchId);
          const batchIds = batchCards.map(c => c.uniqueId);
          const allSelected = batchIds.every(id => selectedCards.has(id));
          const someSelected = batchIds.some(id => selectedCards.has(id));
          const isUngrouped = batchId === '__ungrouped__';
          const batchDate = batchCards[0]?.createdAt
            ? format(new Date(batchCards[0].createdAt), 'MMM d, yyyy HH:mm')
            : 'Unknown date';

          return (
            <Collapsible key={batchId} open={isExpanded} onOpenChange={() => toggleBatchExpand(batchId)}>
              <div className="border border-border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 p-2 md:p-3 bg-muted/50 hover:bg-muted cursor-pointer">
                    {isExpanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs md:text-sm font-medium">
                        {isUngrouped ? 'Ungrouped (legacy)' : `Batch: ${batchDate}`}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({batchCards.length} card{batchCards.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={allSelected}
                        className={someSelected && !allSelected ? 'opacity-70' : ''}
                        onCheckedChange={() => toggleBatchSelectAll(batchCards)}
                        aria-label={`Select all in batch`}
                      />
                      <span className="text-xs text-muted-foreground hidden sm:inline">Select All</span>
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <table className="w-full text-xs md:text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="p-2 w-10"></th>
                        <th className="text-left p-2 font-medium">Card ID</th>
                        <th className="text-left p-2 font-medium">Status</th>
                        <th className="text-left p-2 font-medium">Credits</th>
                        <th className="text-right p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchCards.map((card) => (
                        <tr key={card.id} className={cn(
                          "border-t border-border hover:bg-muted/50",
                          selectedCards.has(card.uniqueId) && "bg-primary/5"
                        )}>
                          <td className="p-2">
                            <Checkbox
                              checked={selectedCards.has(card.uniqueId)}
                              onCheckedChange={() => toggleCardSelection(card.uniqueId)}
                              aria-label={`Select ${card.uniqueId}`}
                            />
                          </td>
                          <td className="p-2 font-mono">{card.uniqueId}</td>
                          <td className="p-2">
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs',
                              card.status === 'active' ? 'bg-success/20 text-success' :
                              card.status === 'checked_out' ? 'bg-warning/20 text-warning' :
                              'bg-muted text-muted-foreground'
                            )}>
                              {card.status}
                            </span>
                          </td>
                          <td className="p-2">{card.creditBalance}/{defaultCreditLimit}</td>
                          <td className="p-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewCard(card.uniqueId)}
                                className="text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCardToUnregister(card.uniqueId)}
                                disabled={isUnregistering}
                                className="text-danger hover:text-danger hover:bg-danger/10 h-7 px-2"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
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
    </div>
  );
};
