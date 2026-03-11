/**
 * Scan service: business logic for enqueueing scans and reading status.
 * Uses Store for persistence and enqueues the Worker; no HTTP concerns.
 */

import { v4 as uuidv4 } from 'uuid';
import { createScan, getScan } from '../store';
import { runScan } from '../workers/scanWorker';
import type { ScanEnqueueResponse, ScanStatusResponse } from '../types';

export function enqueueScan(repoUrl: string): ScanEnqueueResponse {
  const scanId = uuidv4();
  createScan(scanId, repoUrl);

  setImmediate(() => {
    runScan(scanId, repoUrl).catch(() => {
      // Error already stored in scan record by worker
    });
  });

  return { scanId, status: 'Queued' };
}

export function getScanStatus(scanId: string): ScanStatusResponse | null {
  const record = getScan(scanId);
  if (!record) return null;

  const response: ScanStatusResponse = {
    scanId: record.scanId,
    status: record.status,
  };

  if (record.status === 'Finished') {
    response.criticalVulnerabilities = record.criticalVulnerabilities;
  }

  if (record.status === 'Failed' && record.errorMessage) {
    response.errorMessage = record.errorMessage;
  }

  return response;
}
