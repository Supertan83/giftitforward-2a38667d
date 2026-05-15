import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketplaceName?: string;
}

/**
 * Auditor-facing explainer for the Surpluss field semantics.
 * Triggered from the Audit Reconciliation panel.
 */
export function MethodologyDialog({ open, onOpenChange, marketplaceName }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporting Methodology</DialogTitle>
          <DialogDescription>
            How distribution figures are sourced and reconciled
            {marketplaceName ? ` for ${marketplaceName}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h4 className="font-semibold text-foreground mb-1">Data sources</h4>
            <p className="text-muted-foreground">
              All allocation and distribution figures originate from the donor inventory platform
              (Surpluss). The marketplace platform synchronises with Surpluss before, during, and
              after each event. No item quantities are entered manually except for verified post-event
              physical counts where applicable.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-foreground mb-2">Field definitions</h4>
            <dl className="space-y-3">
              <div>
                <dt className="font-medium">Originally Pledged</dt>
                <dd className="text-muted-foreground">
                  The quantity originally allocated to this event by the donor at the time of first
                  synchronisation, before any distribution occurred. Captured as an immutable snapshot.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Distributed at Event</dt>
                <dd className="text-muted-foreground">
                  The quantity actually handed to beneficiaries during the event, recorded via QR-code
                  scans at distribution stations.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Returned to Donor Stock</dt>
                <dd className="text-muted-foreground">
                  The portion of the original pledge that was not distributed during the event and
                  was returned to the donor's general inventory for use in future events. Calculated
                  as <em>Originally Pledged − Distributed</em>.
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h4 className="font-semibold text-foreground mb-1">Reconciliation behaviour</h4>
            <p className="text-muted-foreground">
              The event-level requested quantity is calculated as the physical count total:
              <em> Distributed at Event + Remaining After Event</em>. The remaining quantity is kept
              visible so auditors can reconcile the original allocation against both items used in
              the marketplace and items not distributed.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-foreground mb-1">Events synced before this safeguard</h4>
            <p className="text-muted-foreground">
              For events synchronised before the snapshot mechanism was introduced, the "Originally
              Pledged" column may be unavailable. In those cases the platform displays "—" and notes
              that no pre-reconciliation snapshot is available; the distributed figure remains fully
              auditable via the QR-scan transaction log.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
