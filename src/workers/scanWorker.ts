/**
 * Scan worker: clone repo, run Trivy, stream-parse JSON, extract CRITICAL vulns, cleanup.
 * All I/O is stream-based or bounded; no full-file read.
 * Called by Service; handles Trivy failures and disk-full (ENOSPC) explicitly.
 */

import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import simpleGit from 'simple-git';
import { setStatus, setCriticalVulnerabilities } from '../store';
import { extractCriticalVulnerabilitiesFromFile } from '../streamParser';

const TRIVY_CMD = process.env.TRIVY_CMD ?? 'trivy';

function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      let repo = parts[1];
      if (repo.endsWith('.git')) repo = repo.slice(0, -4);
      return { owner: parts[0], repo };
    }
    return null;
  } catch {
    return null;
  }
}

function cloneRepo(repoUrl: string, targetDir: string): Promise<void> {
  const git = simpleGit();
  return git.clone(repoUrl, targetDir, ['--depth', '1']).then(() => undefined);
}

function runTrivy(repoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      TRIVY_CMD,
      ['fs', '--format', 'json', '--output', outputPath, repoPath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stderr = '';
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`Trivy not found (is it installed?): ${err.message}`));
      } else {
        reject(new Error(`Trivy spawn failed: ${err.message}`));
      }
    });
    proc.on('close', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Trivy exited with code ${code}${signal ? ` signal ${signal}` : ''}: ${stderr || 'no stderr'}`
          )
        );
    });
  });
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOSPC') return 'Disk full: not enough space for clone or Trivy output';
    return err.message;
  }
  return String(err);
}

export async function runScan(scanId: string, repoUrl: string): Promise<void> {
  setStatus(scanId, 'Scanning');

  let workDir: string | null = null;

  try {
    const parsed = parseGitHubRepoUrl(repoUrl);
    if (!parsed) {
      setStatus(scanId, 'Failed', 'Invalid GitHub repository URL');
      return;
    }

    workDir = await mkdtemp(join(tmpdir(), `code-guardian-${scanId}-`));
    const trivyOutputPath = join(workDir, 'trivy-report.json');

    await cloneRepo(repoUrl, workDir);

    await runTrivy(workDir, trivyOutputPath);

    const critical = await extractCriticalVulnerabilitiesFromFile(trivyOutputPath);
    setCriticalVulnerabilities(scanId, critical);
    setStatus(scanId, 'Finished');
  } catch (err) {
    setStatus(scanId, 'Failed', toErrorMessage(err));
  } finally {
    if (workDir) {
      try {
        await rm(workDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; in production log and optionally retry
      }
    }
  }
}
