/**
 * In-memory store for scan records.
 * Only stores metadata + critical vulnerabilities (bounded memory).
 */

import type { ScanRecord, ScanStatus, Vulnerability } from './types';

const scans = new Map<string, ScanRecord>();

export function createScan(scanId: string, repoUrl: string): void {
  const now = new Date();
  scans.set(scanId, {
    scanId,
    status: 'Queued',
    repoUrl,
    createdAt: now,
    updatedAt: now,
    criticalVulnerabilities: [],
  });
}

export function getScan(scanId: string): ScanRecord | undefined {
  return scans.get(scanId);
}

export function setStatus(
  scanId: string,
  status: ScanStatus,
  errorMessage?: string
): void {
  const record = scans.get(scanId);
  if (!record) return;
  record.status = status;
  record.updatedAt = new Date();
  if (errorMessage !== undefined) record.errorMessage = errorMessage;
}

export function setCriticalVulnerabilities(
  scanId: string,
  criticalVulnerabilities: Vulnerability[]
): void {
  const record = scans.get(scanId);
  if (!record) return;
  record.criticalVulnerabilities = criticalVulnerabilities;
  record.updatedAt = new Date();
}
