/**
 * Type definitions for Code Guardian service.
 * No `any` types — full type safety for scan results and API.
 */

export type ScanStatus = 'Queued' | 'Scanning' | 'Finished' | 'Failed';

/** Single vulnerability from Trivy (subset we care about). */
export interface Vulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Title?: string;
  Description?: string;
  Severity: string;
  References?: string[];
}

/** Trivy result target (one entry in Results array). */
export interface TrivyResultTarget {
  Target?: string;
  Vulnerabilities?: Vulnerability[] | null;
}

/** Scan record stored in memory (bounded: only status + critical vulns). */
export interface ScanRecord {
  scanId: string;
  status: ScanStatus;
  repoUrl: string;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  criticalVulnerabilities: Vulnerability[];
}

/** Request body for POST /api/scan */
export interface ScanRequest {
  repoUrl: string;
}

/** Response for POST /api/scan */
export interface ScanEnqueueResponse {
  scanId: string;
  status: ScanStatus;
}

/** Response for GET /api/scan/:scanId */
export interface ScanStatusResponse {
  scanId: string;
  status: ScanStatus;
  criticalVulnerabilities?: Vulnerability[];
  errorMessage?: string;
}
