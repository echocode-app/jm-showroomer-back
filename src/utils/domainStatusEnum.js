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
