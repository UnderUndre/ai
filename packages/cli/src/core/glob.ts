/**
 * Simple glob matching utility.
 * Used to match source files against pipeline patterns.
 */

/**
 * Test if a path matches a glob pattern.
 * Supports: *, **, ?, and literal segments.
 */
export function matchGlob(pattern: string, path: string): boolean {
  // Split pattern into segments, handling ** specially
  let regexStr = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      if (pattern[i + 2] === "/") {
        // **/ = zero or more directories
        regexStr += "(?:.+/)?";
        i += 3;
      } else {
        // ** = match anything
        regexStr += ".*";
        i += 2;
      }
    } else if (pattern[i] === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (pattern[i] === "?") {
      regexStr += "[^/]";
      i++;
    } else {
      // Escape regex metacharacters in literal segments
      const ch = pattern[i]!;
      if (".()[]{}+^$|\\".includes(ch)) {
        regexStr += `\\${ch}`;
      } else {
        regexStr += ch;
      }
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`).test(path);
}

/**
 * Resolve output path template with variables.
 */
export function resolveOutputPath(
  template: string,
  sourcePath: string,
): string {
  const name = sourcePath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
  const ext = sourcePath.match(/\.[^.]+$/)?.[0] ?? "";

  return template
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{relativePath\}\}/g, sourcePath)
    .replace(/\{\{ext\}\}/g, ext);
}
