/**
 * Source repo fetch wrapper around giget.
 * Auth resolution order per FR-021:
 * 1. Explicit auth param
 * 2. GH_TOKEN env
 * 3. GIGET_AUTH env
 * 4. `gh auth token` subprocess (if gh CLI available)
 */

import { downloadTemplate } from "giget";
import { execSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { join } from "pathe";
import { tmpdir } from "node:os";

interface FetchOptions {
  offline?: boolean;
  preferOffline?: boolean;
}

interface FetchResult {
  dir: string;
  commit: string;
}

export async function fetchSource(
  url: string,
  ref?: string,
  auth?: string,
  options?: FetchOptions,
): Promise<FetchResult> {
  const resolvedAuth = auth ?? resolveAuth();
  const templateUrl = ref ? `${url}#${ref}` : url;

  // Download to OS temp dir — NOT cwd — to avoid polluting the project
  const tempDir = await mkdtemp(join(tmpdir(), "helpers-source-"));

  const result = await downloadTemplate(templateUrl, {
    dir: tempDir,
    auth: resolvedAuth,
    offline: options?.offline,
    preferOffline: options?.preferOffline,
    force: true,
    forceClean: true,
  });

  // Resolve commit SHA — skip network call in offline mode
  const commit = options?.offline
    ? (ref ?? "offline")
    : await resolveCommitSha(url, ref, resolvedAuth);

  return {
    dir: result.dir,
    commit,
  };
}

function resolveAuth(): string | undefined {
  // 1. GH_TOKEN env
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;

  // 2. GIGET_AUTH env (giget reads this natively, but we're explicit)
  if (process.env.GIGET_AUTH) return process.env.GIGET_AUTH;

  // 3. gh auth token subprocess
  try {
    const token = execSync("gh auth token", {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (token) return token;
  } catch {
    // gh not available or not authenticated
  }

  return undefined;
}

/**
 * Resolve commit SHA via GitHub API or fall back to ref as-is.
 * giget downloads flat snapshots without .git/, so we can't use git rev-parse.
 */
async function resolveCommitSha(
  url: string,
  ref?: string,
  auth?: string,
): Promise<string> {
  // Parse GitHub owner/repo from URL
  const match = url.match(/github[.:]([^/]+)\/([^/#]+)/);
  if (!match) return ref ?? "unknown";

  const [, owner, repo] = match;
  const branch = ref ?? "HEAD";

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
    };
    if (auth) headers.Authorization = `Bearer ${auth}`;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
      { headers },
    );

    if (response.ok) {
      const data = (await response.json()) as { sha: string };
      return data.sha;
    }
  } catch {
    // Network error — return ref as-is
  }

  return ref ?? "unknown";
}
