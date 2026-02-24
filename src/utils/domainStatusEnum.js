// Allowed semantic statuses for domain logs.
// Enforcement prevents silent drift such as ad-hoc statuses in controllers.
export const DOMAIN_STATUS = [
  "success",
  "failed",
  "blocked",
  "added",
  "removed",
  "infra",
];

export function isDomainStatus(status) {
  if (status == null) return true;
  return DOMAIN_STATUS.includes(status);
}
