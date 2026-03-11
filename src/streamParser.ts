/**
 * Stream-based Trivy JSON parser.
 * REQUIREMENTS: No fs.readFile, no JSON.parse on scan results. Use Node.js Streams
 * to read and parse the file object-by-object (stream-json).
 * This module uses only createReadStream + stream-json pipeline — never loads the file into a variable.
 */

import { createReadStream } from 'fs';
import { chain } from 'stream-chain';
import createParser from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamValues } from 'stream-json/streamers/StreamValues';
import type { Vulnerability } from './types';

const TRIVY_VULN_PATH_REGEX = /^Results\.\d+\.Vulnerabilities\.\d+$/;

/**
 * Extract critical vulnerabilities from a Trivy JSON file using streams only.
 * Path in Trivy JSON: root.Results[i].Vulnerabilities[j] — we pick each vulnerability object
 * and filter by Severity === 'CRITICAL'.
 */
export function extractCriticalVulnerabilitiesFromFile(
  jsonPath: string
): Promise<Vulnerability[]> {
  const critical: Vulnerability[] = [];

  const readStream = createReadStream(jsonPath, { encoding: 'utf8' });

  const pipeline = chain([
    readStream,
    createParser(),
    pick({
      filter: (stack: unknown) => {
        const path = Array.isArray(stack) ? (stack as (string | number)[]).join('.') : String(stack);
        return TRIVY_VULN_PATH_REGEX.test(path);
      },
    }),
    streamValues(),
  ]);

  return new Promise((resolve, reject) => {
    pipeline.on('data', (data: { value: unknown }) => {
      const value = data.value;
      if (
        value &&
        typeof value === 'object' &&
        'Severity' in value &&
        (value as Vulnerability).Severity === 'CRITICAL'
      ) {
        critical.push(value as Vulnerability);
      }
    });
    pipeline.on('end', () => resolve(critical));
    pipeline.on('error', reject);
  });
}
