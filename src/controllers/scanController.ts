/**
 * Scan controller: HTTP request/response handling and validation.
 * Delegates to Service; no direct Store or Worker access.
 */

import { Request, Response } from 'express';
import { enqueueScan, getScanStatus } from '../services/scanService';
import type { ScanRequest } from '../types';

function isValidRepoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' && u.pathname.length > 1;
  } catch {
    return false;
  }
}

export function enqueueScanHandler(req: Request, res: Response): void {
  const body = req.body as Partial<ScanRequest>;
  const repoUrl = typeof body?.repoUrl === 'string' ? body.repoUrl.trim() : '';

  if (!repoUrl) {
    res.status(400).json({ error: 'Missing or invalid repoUrl' });
    return;
  }

  if (!isValidRepoUrl(repoUrl)) {
    res.status(400).json({ error: 'repoUrl must be a valid GitHub HTTPS URL' });
    return;
  }

  const result = enqueueScan(repoUrl);
  res.status(202).json(result);
}

export function getScanStatusHandler(req: Request, res: Response): void {
  const { scanId } = req.params;
  const result = getScanStatus(scanId);

  if (!result) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }

  res.json(result);
}
