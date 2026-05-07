# Feature Specification: Fleet Sync — multi-project discovery and on-demand sync

**Feature Branch**: `003-fleet-sync`
**Created**: 2026-05-06
**Status**: Draft
**Input**: User description: "теперь я хочу фичу, чтобы автоматом синкать эти хелперы в проектах, где они у меня установлены — точнее, я хочу видеть, где установлено и синкать по необходимости, с возможностью выбора одного и/или более проектов для синка/апдейта"

## User Scenarios & Testing

### User Story 1 — Discover what's installed where (Priority: P1)

The maintainer of clai-helpers (or any user with clai-helpers in multiple projects) wants a single command that lists every project on their machine where clai-helpers is installed, showing each project's path, the version it's pinned to, the latest available version, and whether the local tree has drifted from its pinned source.

**Why this priority**: Visibility is the prerequisite for action. Without "what do I have", there's no informed "what to update". This story alone (no sync action) already replaces ad-hoc grep/find sessions across the user's machine and answers the recurring question "which of my projects are on stale templates?". It is the **MVP**: even without the sync action in P2, just knowing which projects exist and their state is valuable.

**Independent Test**: Run the discovery command on a machine with two consumer projects pinned to different versions. Verify output lists both with correct path, current ref, latest ref, and drift status. No mutation occurs.

**Acceptance Scenarios**:

1. **Given** the user has clai-helpers installed in 3 local projects, **When** they invoke the fleet listing command, **Then** the output shows all 3 projects with their paths, pinned refs, latest available refs, and drift indicators.
2. **Given** no projects use clai-helpers, **When** the user invokes the listing command, **Then** they receive a clear "no projects found" message including which paths were searched.
3. **Given** a previously-listed project was deleted from disk, **When** the listing runs again, **Then** the deleted project does not appear and no error is raised.
4. **Given** a project's lock metadata is corrupt or unreadable, **When** the listing runs, **Then** that project is shown with an "unreadable" status and processing continues for other projects.

---

### User Story 2 — Sync selected projects interactively (Priority: P2)

After viewing the fleet, the user picks one or more projects from a list and triggers an upgrade sync on each. Selection is via a multi-select picker (checkbox-style) presented in the terminal. The user confirms before any sync runs. After confirmation, syncs run sequentially with progress feedback per project, and a final summary reports successes and failures.

**Why this priority**: This is the headline interaction. P1 gives visibility; P2 turns visibility into a workflow. Sequential rather than parallel by default avoids overwhelming the user with concurrent network activity and makes failures easier to read.

**Independent Test**: With 4 known consumer projects on stale versions, invoke the interactive sync, select 2 of them via the picker, confirm, observe two syncs run, and verify only the selected 2 advanced their pinned refs while the other 2 remain unchanged.

**Acceptance Scenarios**:

1. **Given** 4 projects shown in the fleet, **When** the user selects 2 and confirms, **Then** exactly those 2 projects are synced and their pinned refs advance to the latest; the other 2 remain at their prior refs.
2. **Given** a selected project has uncommitted local changes, **When** sync would run on it, **Then** that project is skipped with a clear "dirty tree, skipping" message and the next project proceeds.
3. **Given** sync fails on one selected project (network error, missing auth, etc.), **When** processing continues, **Then** subsequent selected projects still get their chance, and the final summary clearly distinguishes succeeded vs. failed projects with the failure reason.
4. **Given** the user selects nothing in the picker and confirms, **When** the command proceeds, **Then** no syncs run and the user is told "nothing selected, exiting cleanly".
5. **Given** a project being synced is concurrently being modified by another process (lock present), **When** the command tries to sync it, **Then** that project is skipped with a "process lock present" message and other projects proceed.

---

### User Story 3 — Non-interactive sync for automation (Priority: P3)

A user (or a CI script, or a scheduled task) wants to run sync against a known subset of projects without an interactive picker — by name, by glob, or via "everything". The command must accept flags that fully describe the selection so it can run unattended and exit with a meaningful code.

**Why this priority**: Power-user / automation case. Less critical than the interactive flow because most users will pick from the list, but essential for users who want this in cron or CI.

**Independent Test**: With 5 known projects, run the command with a flag selecting "all that match a name pattern" and verify only matching projects are synced. Re-run with `--all` and verify all are processed. Re-run with a project that doesn't exist by name and verify a non-zero exit code with a clear error.

**Acceptance Scenarios**:

1. **Given** the user runs the sync with a flag selecting all projects, **When** processing completes, **Then** every discovered project was attempted and a summary line indicates total succeeded / failed / skipped.
2. **Given** the user passes a project name that does not exist, **When** the command runs, **Then** it exits non-zero with an error message naming the unknown project — without syncing any other projects.
3. **Given** the user passes a glob/pattern matching 3 of 5 projects, **When** the command runs, **Then** exactly those 3 are synced.

---

### Edge Cases

- **Project moved on disk between runs**: Discovery should never assume a stale path is still valid. If a previously-known project's path no longer contains the marker, it is omitted from this run's output without raising an error.
- **Multiple installations in one workspace** (e.g., a monorepo with several `helpers-lock.json` files at different paths): Each is treated as a distinct fleet entry with its full path; selection by path uniquely identifies each.
- **Project pinned to a floating ref** (e.g., a branch name like `main` rather than a tag): "Latest available" is interpreted as the current head of that ref. "Drift" is computed against the resolved commit.
- **Network unavailable while listing**: Listing still works for the locally-known data (path, current pinned ref); "latest available" is shown as "unknown — offline" without failing the run.
- **Authentication missing for a private upstream** during sync: That project's sync fails with a clear "auth required" message; other projects proceed.
- **Massive fleet** (50+ projects): Listing must remain responsive (target: complete within a few seconds for typical fleets); sync runs sequentially so progress is per-project.
- **User aborts mid-fleet** (Ctrl-C during a multi-project sync): Whatever project is currently syncing must clean up its working state (no half-applied trees); already-completed projects stay synced; remaining selected projects are not started; the summary reports "interrupted by user" for the remainder.

## Requirements

### Functional Requirements

- **FR-001**: System MUST discover all projects on the user's machine that have clai-helpers installed by searching for the canonical install marker (`helpers-lock.json`) under user-configurable root paths.
- **FR-002**: System MUST present a list view of discovered projects with at minimum: project path, current pinned ref, latest available ref (or "unknown — offline"), and a drift indicator (managed files match pinned source, yes/no).
- **FR-003**: Users MUST be able to select one or more projects from the list interactively (multi-select picker) and confirm before any sync action runs.
- **FR-004**: Users MUST be able to select projects non-interactively via flags: select all, select by name pattern, select by explicit list of paths.
- **FR-005**: System MUST execute selected syncs sequentially by default with per-project progress feedback. Optional concurrency settings are out of scope for the first release.
- **FR-006**: System MUST skip (not fail) a selected project when its working tree is dirty, when a process lock is present, or when network/auth prerequisites are missing — and clearly report each skip with the reason.
- **FR-007**: System MUST produce a final summary at the end of any sync session with three lines: succeeded count, failed count (each with project name and one-line reason), skipped count.
- **FR-008**: System MUST exit with a non-zero status if any selected project failed to sync (non-zero failure count); exit zero otherwise. Skips are not failures.
- **FR-009**: System MUST never modify a project's working tree when only listing (P1) — listing is strictly read-only.
- **FR-010**: System MUST never push, publish, or take any network-mutating action on a synced project as a side effect of sync. Only local files are updated.
- **FR-011**: System MUST persist a record of the last successful sync per project (timestamp, ref before, ref after) so the listing can show "last synced" alongside drift.
- **FR-012**: System MUST [NEEDS CLARIFICATION: discovery strategy — scan-on-every-invocation (slow but always fresh) vs. cached registry (fast but can show stale entries) vs. explicit `register/unregister` subcommands (fast and accurate, but requires setup). Each has different UX implications for first-time users vs. power users with 30+ projects.]

### Key Entities

- **Fleet Entry**: A single project where clai-helpers is installed. Attributes: absolute path, project name (derived from path or package metadata), current pinned ref, current pinned source URL, latest available ref (resolved at list time), drift state, last successful sync timestamp, last sync ref-before / ref-after.
- **Selection**: A subset of fleet entries chosen for a sync session. Source: interactive picker, name pattern, explicit paths, or "all".
- **Sync Result**: Per-entry outcome of a sync attempt. State: succeeded / failed / skipped, with reason for the latter two and the resulting ref change for succeeded.
- **Sync Session**: One invocation of the multi-project sync with its selection and per-entry sync results, summarized at the end.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Listing the fleet on a machine with up to 20 projects returns within 3 seconds (excluding optional online "latest ref" resolution, which may add network latency per project).
- **SC-002**: A user new to the feature can identify which of their projects are on stale templates within 30 seconds of running the command for the first time, without consulting documentation beyond the on-screen output.
- **SC-003**: Of all sync sessions across the user base, at least 95% complete with zero data loss in any selected project (measured: no project ends in a half-applied state after the session, including interrupts).
- **SC-004**: The number of separate `cd` + `sync` invocations the user performs per quarter for upgrade campaigns drops by at least 80% compared to the pre-feature baseline (measured by user self-report or shell history audit).
- **SC-005**: A failed sync of one project never aborts the rest of the session — exactly one summary covers all selected projects regardless of individual outcomes.

## Assumptions

- Discovery is local-only on the user's machine. Remote inventories (e.g. listing GitHub repos that consume clai-helpers via a webhook search) are out of scope for this release.
- A project is considered to "have clai-helpers installed" if and only if `helpers-lock.json` is present at that project's root. Other markers are out of scope for the first release.
- The feature is invoked manually. Scheduled or background auto-sync is explicitly out of scope (the user clarified "по необходимости" — on demand).
- Listing's network calls (resolving "latest available" per project) honor the user's existing offline-mode preferences. No new auth or network surface is introduced by this feature beyond what the existing single-project sync already requires.
- The user's existing per-project authentication (env vars, gh CLI auth, etc.) carries over to fleet sync. Fleet sync does not introduce a new auth registry.
- Standing Orders apply: no commits, pushes, or destructive operations are performed automatically by this feature. Sync only updates managed files in each project's working tree; the user commits per project at their own discretion.
