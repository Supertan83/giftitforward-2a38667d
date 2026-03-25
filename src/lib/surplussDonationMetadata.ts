import { supabase } from '@/integrations/supabase/client';

export type SurplussEnv = 'production' | 'staging';

/** Material fields returned inside donation metadata from Tractor API */
export interface SurplussDonationMaterial {
  id?: number;
  title?: string;
  item_count?: number;
}

/** Donation metadata row from Tractor (QR / allocation source of truth for remaining) */
export interface SurplussDonationMetadataRow {
  id?: number;
  material_id?: number;
  total_remaining_item_count?: number;
  material?: SurplussDonationMaterial;
}

type EdgeEnvelope = {
  success?: boolean;
  status?: number;
  data?: { success?: boolean; data?: SurplussDonationMetadataRow; error?: string };
};

/**
 * Fetches donation metadata for one material via surpluss-allocations-api (Tractor GET …/donation-metadata/:id).
 * Mirrors QR scan behavior on Tractor (may create metadata if missing for a valid donation material).
 */
export async function fetchSurplussDonationMetadataForMaterial(
  materialId: number,
  environment: SurplussEnv = 'production',
): Promise<
  | { ok: true; metadata: SurplussDonationMetadataRow }
  | { ok: false; error: string; httpStatus?: number }
> {
  const { data, error } = await supabase.functions.invoke('surpluss-allocations-api', {
    body: {
      action: 'get_donation_metadata_by_material',
      material_id: materialId,
      environment,
    },
  });

  if (error) return { ok: false, error: error.message };
  if (data == null) return { ok: false, error: 'No response from surpluss-allocations-api' };

  const envelope = data as EdgeEnvelope;
  if (!envelope.success) {
    const inner = envelope.data;
    const msg =
      inner && typeof inner === 'object' && 'error' in inner && inner.error != null
        ? String(inner.error)
        : `Tractor request failed (HTTP ${envelope.status ?? '?'})`;
    return { ok: false, error: msg, httpStatus: envelope.status };
  }

  const inner = envelope.data;
  if (!inner?.success || inner.data == null) {
    const msg =
      inner && typeof inner.error === 'string' ? inner.error : 'Invalid Tractor response';
    return { ok: false, error: msg, httpStatus: envelope.status };
  }

  return { ok: true, metadata: inner.data };
}
