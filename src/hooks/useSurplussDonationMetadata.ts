import { useState, useCallback } from 'react';
import {
  fetchSurplussDonationMetadataForMaterial,
  SurplussDonationMetadataRow,
  SurplussEnv,
} from '@/lib/surplussDonationMetadata';

export interface UseSurplussDonationMetadataReturn {
  metadata: SurplussDonationMetadataRow | null;
  isLoading: boolean;
  error: string | null;
  fetch: (materialId: number, environment?: SurplussEnv) => Promise<SurplussDonationMetadataRow | null>;
  reset: () => void;
}

export function useSurplussDonationMetadata(): UseSurplussDonationMetadataReturn {
  const [metadata, setMetadata] = useState<SurplussDonationMetadataRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(
    async (materialId: number, environment: SurplussEnv = 'production') => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchSurplussDonationMetadataForMaterial(materialId, environment);
        if (result.ok) {
          setMetadata(result.metadata);
          return result.metadata;
        } else {
          setError(result.error);
          setMetadata(null);
          return null;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setMetadata(null);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setMetadata(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { metadata, isLoading, error, fetch, reset };
}
