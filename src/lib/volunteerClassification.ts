// Companies that should be treated as Dubai Holding "internal" even when
// is_employee = false (e.g. DH subsidiaries). Keep entries lowercased.
export const DH_INTERNAL_COMPANIES = ['ejadah'];

export const isInternalCompany = (companyName?: string | null): boolean => {
  if (!companyName) return false;
  return DH_INTERNAL_COMPANIES.includes(companyName.trim().toLowerCase());
};

export type VolunteerClassification = 'internal' | 'external' | 'outreach';

export const classifyVolunteer = (vol: {
  is_employee?: boolean | null;
  external_company?: string | null;
}): { categoryKey: string; classification: VolunteerClassification } => {
  if (vol.is_employee || isInternalCompany(vol.external_company)) {
    return { categoryKey: 'Corporate Internal', classification: 'internal' };
  }
  if (vol.external_company) {
    return { categoryKey: 'Corporate External', classification: 'external' };
  }
  return { categoryKey: 'Outreach Partners', classification: 'outreach' };
};

export const resolveCompanyName = (vol: {
  is_employee?: boolean | null;
  external_company?: string | null;
}): string => {
  if (vol.is_employee && !vol.external_company) return 'Dubai Holding';
  return vol.external_company || 'Other';
};
