import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  fetchSurplussDonationMetadataForMaterial,
  type SurplussDonationMetadataRow,
  type SurplussEnv,
} from '@/lib/surplussDonationMetadata';

function normalizeMaterialId(materialId: number | null | undefined): number | null {
  if (materialId == null) return null;
  const n = Number(materialId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Read-only Tractor donation metadata for reconcile UI (Allocate modal, material lookup).
 */
export function useSurplussDonationMetadata(
  materialId: number | null | undefined,
  opts?: { enabled?: boolean; environment?: SurplussEnv },
): UseQueryResult<SurplussDonationMetadataRow, Error> {
  const id = normalizeMaterialId(materialId);
  const env = opts?.environment ?? 'production';
  const enabled = id != null && (opts?.enabled ?? true);

  return useQuery({
    queryKey: ['surpluss-donation-metadata', id, env],
    queryFn: async () => {
      const r = await fetchSurplussDonationMetadataForMaterial(id!, env);
      if (r.ok === false) throw new Error(r.error);
      return r.metadata;
    },
    enabled,
    staleTime: 30_000,
  });
}
