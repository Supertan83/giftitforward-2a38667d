/**
 * Discrepancy resolver for the GIF audit export.
 *
 * Given a Material ID's platform numbers vs the auditor reference, returns a
 * classification + written explanation. Rules are applied in priority order
 * and the first match wins. New rules should be added before UNEXPLAINED.
 *
 * Status semantics:
 *   - 'resolved'    → no investigation needed, numbers reconcile or sit
 *                     inside an accepted tolerance.
 *   - 'documented'  → there IS a delta, but its cause is known and accepted
 *                     by programme leadership.
 *   - 'unexplained' → real delta with no known cause — needs follow-up.
 */

export type ResolverStatus = 'resolved' | 'documented' | 'unexplained';

export interface ResolverInput {
  materialId: number;
  donor: string;
  /** Platform totals */
  platformReceived: number;
  platformDistributed: number;
  platformRemaining: number;
  /** Auditor reference totals (null when the material is not in the reference) */
  refReceived: number | null;
  refDistributed: number | null;
  refRemaining: number | null;
  /** True when at least one allocation row has original_allocated_quantity
   *  greater than its current allocated_quantity (= Surpluss reconciled). */
  hasSurplussReconciliation: boolean;
  /** True when the marketplace(s) for this material only have a
   *  manual_beneficiary_count and no per-card scan log. */
  reliesOnManualCount: boolean;
}

export interface ResolverResult {
  status: ResolverStatus;
  reasonCode: string;
  explanation: string;
}

export interface ResolverRule {
  code: string;
  trigger: string;
  /** Returned to the auditor verbatim when the rule fires */
  explanation: string;
  status: ResolverStatus;
  matches: (i: ResolverInput) => boolean;
}

const dRx = (i: ResolverInput) => (i.refReceived ?? 0) - i.platformReceived;
const dD  = (i: ResolverInput) => (i.refDistributed ?? 0) - i.platformDistributed;
const dRem= (i: ResolverInput) => (i.refRemaining ?? 0) - i.platformRemaining;

const absMax = (...n: number[]) => Math.max(...n.map((x) => Math.abs(x)));

const IN_KIND_DONOR_PATTERNS = [/al\s*jaber/i];

export const RESOLVER_RULES: ResolverRule[] = [
  {
    code: 'MATCH',
    trigger: 'All three deltas (received, distributed, remaining) = 0.',
    explanation: 'Platform values match the auditor reference exactly.',
    status: 'resolved',
    matches: (i) =>
      i.refReceived !== null && dRx(i) === 0 && dD(i) === 0 && dRem(i) === 0,
  },
  {
    code: 'WITHIN_TOLERANCE',
    trigger: '|Δ| ≤ 5 units AND ≤ 1% of reference on each of the three metrics.',
    explanation:
      'Within rounding / batch-count tolerance — typically caused by single-item adjustments at sorting.',
    status: 'resolved',
    matches: (i) => {
      if (i.refReceived === null) return false;
      const within = (delta: number, ref: number) =>
        Math.abs(delta) <= 5 && (ref === 0 ? Math.abs(delta) === 0 : Math.abs(delta) / ref <= 0.01);
      return (
        within(dRx(i), i.refReceived ?? 0) &&
        within(dD(i), i.refDistributed ?? 0) &&
        within(dRem(i), i.refRemaining ?? 0)
      );
    },
  },
  {
    code: 'SURPLUSS_RECONCILE',
    trigger:
      'Platform distributed matches auditor, but platform live allocation < original pledged ' +
      '(donor inventory reconciled post-event).',
    explanation:
      'Surpluss post-event reconciliation released unused pledge back to donor stock. ' +
      'Original pledge is preserved in the platform snapshot; distribution outcome is unchanged.',
    status: 'documented',
    matches: (i) =>
      i.refDistributed !== null &&
      dD(i) === 0 &&
      i.hasSurplussReconciliation,
  },
  {
    code: 'IN_KIND',
    trigger: 'Donor is on the in-kind list (e.g. Al Jaber).',
    explanation:
      'In-kind donation — the auditor reference excludes this line because items were ' +
      'handled outside the standard donor pipeline. Platform totals are authoritative.',
    status: 'documented',
    matches: (i) => IN_KIND_DONOR_PATTERNS.some((re) => re.test(i.donor || '')),
  },
  {
    code: 'MANUAL_COUNT',
    trigger:
      'Marketplace beneficiary figure came from a partner sign-off sheet, not from per-card QR scans.',
    explanation:
      'Beneficiary count recorded manually by the outreach partner — no per-card scan log ' +
      'is available, so item-level distribution attribution is approximate.',
    status: 'documented',
    matches: (i) => i.reliesOnManualCount && dD(i) !== 0,
  },
  {
    code: 'SCOPE_DIFF_EXTRA',
    trigger: 'Material exists on platform but is absent from the auditor reference.',
    explanation:
      'Out of audit scope — donated and/or distributed through a non-tracked channel. ' +
      'Included here for completeness only.',
    status: 'documented',
    matches: (i) => i.refReceived === null,
  },
  {
    code: 'SCOPE_DIFF_MISSING',
    trigger: 'Material exists in the auditor reference but no record on platform.',
    explanation:
      'Reference row not present on platform. Likely pre-platform paper record — requires ' +
      'manual cross-check with the warehouse intake log.',
    status: 'unexplained',
    matches: (i) =>
      i.refReceived !== null &&
      i.platformReceived === 0 &&
      i.platformDistributed === 0 &&
      i.platformRemaining === 0,
  },
  {
    code: 'UNEXPLAINED',
    trigger: 'Any non-zero delta not covered by the rules above.',
    explanation:
      'Delta has no documented cause. Requires programme-team investigation before sign-off.',
    status: 'unexplained',
    matches: () => true, // catch-all, must be last
  },
];

export function resolveDiscrepancy(input: ResolverInput): ResolverResult {
  for (const rule of RESOLVER_RULES) {
    if (rule.matches(input)) {
      return {
        status: rule.status,
        reasonCode: rule.code,
        explanation: rule.explanation,
      };
    }
  }
  // unreachable — UNEXPLAINED is the catch-all
  return { status: 'unexplained', reasonCode: 'UNEXPLAINED', explanation: '' };
}

export const statusRank = (s: ResolverStatus) =>
  s === 'unexplained' ? 0 : s === 'documented' ? 1 : 2;
