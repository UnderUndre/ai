/**
 * Unit tests for pr-mode.ts.
 * Mocks: node:child_process, node:fs/promises, node:util,
 *         ephemeral-clone, github-api, run-sync.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FleetEntry, SyncResult } from "../../../../src/core/fleet/types.js";
import { FleetError } from "../../../../src/core/fleet/types.js";

// ── Test fixtures ────────────────────────────────────────────────────

const TEST_ENTRY: FleetEntry = {
  fullName: "testowner/testrepo",
  shortName: "testrepo",
  defaultBranch: "main",
  pinnedRef: "v0.3.0",
  pinnedSource: "github:UnderUndre/ai",
  latestRef: "v0.4.0",
  hasDrift: true,
  lastSyncAt: "2026-01-15T10:30:00Z",
  state: "active",
  unreadableReason: null,
};

const AUTH = "ghp_testtoken123";

// ── Mocks ────────────────────────────────────────────────────────────

const {
  mockCleanup,
  mockFindOpenPullRequest,
  mockCreatePullRequest,
  mockRunSyncPipeline,
  mockHasWorkingTreeChanges,
  mockExecFileAsync,
} = vi.hoisted(() => ({
  mockCleanup: vi.fn<() => Promise<void>>(),
  mockFindOpenPullRequest: vi.fn(),
  mockCreatePullRequest: vi.fn(),
  mockRunSyncPipeline: vi.fn<() => Promise<boolean>>(),
  mockHasWorkingTreeChanges: vi.fn<() => Promise<boolean>>(),
  mockExecFileAsync: vi.fn(),
}));

vi.mock("../../../../src/core/fleet/ephemeral-clone.js", () => ({
  createEphemeralClone: vi.fn(() =>
    Promise.resolve({
      dir: "/tmp/helpers-fleet-test",
      cleanup: mockCleanup,
    }),
  ),
}));

vi.mock("../../../../src/core/fleet/github-api.js", () => ({
  findOpenPullRequest: (...args: unknown[]) => mockFindOpenPullRequest(...args),
  createPullRequest: (...args: unknown[]) => mockCreatePullRequest(...args),
}));

vi.mock("../../../../src/core/fleet/modes/run-sync.js", () => ({
  get runSyncPipeline() { return mockRunSyncPipeline; },
  get hasWorkingTreeChanges() { return mockHasWorkingTreeChanges; },
  getHeadSha: vi.fn(() => Promise.resolve("abc123")),
  getFullDiff: vi.fn(() => Promise.resolve("diff content")),
}));

vi.mock("node:util", () => ({
  promisify: () => mockExecFileAsync,
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// ── Import after mocks ───────────────────────────────────────────────

import { syncPr } from "../../../../src/core/fleet/modes/pr-mode.js";

// ── Tests ────────────────────────────────────────────────────────────

describe("syncPr", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunSyncPipeline.mockResolvedValue(true);
    mockHasWorkingTreeChanges.mockResolvedValue(true);
    mockExecFileAsync.mockResolvedValue({ stdout: "", stderr: "" });
    mockCleanup.mockResolvedValue(undefined);
    mockCreatePullRequest.mockResolvedValue({
      html_url: "https://github.com/testowner/testrepo/pull/1",
      number: 1,
    });
    mockFindOpenPullRequest.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Happy path → succeeded with prUrl ──────────────────────────

  it("returns succeeded with prUrl on happy path", async () => {
    const result = await syncPr(TEST_ENTRY, AUTH, "v0.4.0", mockFetch);

    expect(result.outcome).toBe("succeeded");
    expect(result.mode).toBe("pr");
    expect(result.prUrl).toBe("https://github.com/testowner/testrepo/pull/1");
    expect(result.refBefore).toBe("v0.3.0");
    expect(result.refAfter).toBe("v0.4.0");
    expect(result.fullName).toBe("testowner/testrepo");
    expect(typeof result.durationMs).toBe("number");
  });

  // ── 2. No-op short-circuit (clean diff) ───────────────────────────

  it("returns no-op when sync pipeline reports no changes", async () => {
    mockRunSyncPipeline.mockResolvedValue(false);
    mockHasWorkingTreeChanges.mockResolvedValue(false);

    const result = await syncPr(TEST_ENTRY, AUTH, "v0.4.0", mockFetch);

    expect(result.outcome).toBe("no-op");
    expect(result.refBefore).toBe("v0.3.0");
    expect(result.refAfter).toBe("v0.3.0");
    // Should NOT create branch/commit/push
    expect(mockExecFileAsync).not.toHaveBeenCalled();
  });

  // ── 3. Idempotent: existing open PR → succeeded with existing prUrl ─

  it("returns succeeded with existing prUrl when open PR already exists", async () => {
    mockFindOpenPullRequest.mockResolvedValue({
      html_url: "https://github.com/testowner/testrepo/pull/42",
      number: 42,
    });

    const result = await syncPr(TEST_ENTRY, AUTH, "v0.4.0", mockFetch);

    expect(result.outcome).toBe("succeeded");
    expect(result.prUrl).toBe("https://github.com/testowner/testrepo/pull/42");
    // Should NOT create a new PR
    expect(mockCreatePullRequest).not.toHaveBeenCalled();
  });

  // ── 4. Clone failure → failed with errorCode ──────────────────────

  it("returns failed with errorCode git/clone-failed on clone failure", async () => {
    const { createEphemeralClone } = await import("../../../../src/core/fleet/ephemeral-clone.js");
    vi.mocked(createEphemeralClone).mockRejectedValueOnce(
      new FleetError("git/clone-failed", "Failed to clone repo"),
    );

    const result = await syncPr(TEST_ENTRY, AUTH, "v0.4.0", mockFetch);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.errorCode).toBe("git/clone-failed");
    }
  });

  // ── 5. Cleanup always called ──────────────────────────────────────

  it("cleanup is called even on success", async () => {
    await syncPr(TEST_ENTRY, AUTH, "v0.4.0", mockFetch);
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });
});
