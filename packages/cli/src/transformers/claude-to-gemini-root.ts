/**
 * claude-to-gemini-root: Convert CLAUDE.md to GEMINI.md.
 * Rewrites .claude/ references to .gemini/ paths.
 * Strips Protected Slot markers.
 */

import { FileKind } from "../types/common.js";
import { injectHeader } from "../core/header.js";
import type { TransformerFn, ParsedFile, TransformContext, RenderedFile } from "./types.js";

const claudeToGeminiRoot: TransformerFn = (
  source: ParsedFile,
  _ctx: TransformContext,
): RenderedFile => {
  let body = source.body;

  // Rewrite .claude/ → .gemini/ references
  body = body.replace(/\.claude\/agents\/(\w+)\.md/g, ".gemini/agents/$1.md");
  body = body.replace(/\.claude\/commands\/(\w+)\.md/g, ".gemini/commands/$1.toml");

  // Strip Protected Slot markers and their content
  body = body.replace(
    /<!--\s*HELPERS:CUSTOM\s+START\s*-->[\s\S]*?<!--\s*HELPERS:CUSTOM\s+END\s*-->\n?/g,
    "",
  );

  // Clean up extra blank lines
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  const content = injectHeader(`\n${body}\n`, source.sourcePath, ".md");

  return {
    targetPath: "GEMINI.md",
    content,
    kind: FileKind.Generated,
    fromSource: source.sourcePath,
    transformer: "claude-to-gemini-root",
  };
};

export default claudeToGeminiRoot;
