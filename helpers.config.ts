// @ts-check
/** @type {import("clai-helpers").HelpersConfig} */
export default {
  version: 1,

  sources: [
    // AI prompts, commands, agents, skills (root-relative paths)
    ".claude/commands/**/*.md",
    ".claude/agents/**/*.md",
    ".claude/skills/**/*",
    "CLAUDE.md",
    // Copilot instructions (already-formatted, copy as-is)
    ".github/instructions/**/*.md",
    // Speckit pipeline scripts
    ".specify/**/*",
  ],

  targets: {
    claude: {
      pipelines: [
        {
          transformer: "identity",
          match: ".claude/**/*",
          output: "{{relativePath}}",
        },
        {
          transformer: "identity",
          match: "CLAUDE.md",
          output: "CLAUDE.md",
          class: "core",
        },
      ],
    },

    copilot: {
      pipelines: [
        {
          transformer: "claude-to-copilot-prompt",
          match: ".claude/commands/**/*.md",
          output: ".github/prompts/{{name}}.prompt.md",
        },
        {
          transformer: "claude-to-copilot-instructions",
          match: ".claude/agents/**/*.md",
          output: ".github/instructions/{{name}}.instructions.md",
        },
        {
          transformer: "claude-to-copilot-root-instructions",
          match: "CLAUDE.md",
          output: ".github/copilot-instructions.md",
        },
        {
          transformer: "identity",
          match: ".github/instructions/**/*.md",
          output: "{{relativePath}}",
        },
      ],
    },

    gemini: {
      pipelines: [
        {
          transformer: "claude-to-gemini-command",
          match: ".claude/commands/**/*.md",
          output: ".gemini/commands/{{name}}.toml",
        },
        {
          transformer: "claude-to-gemini-agent",
          match: ".claude/agents/**/*.md",
          output: ".gemini/agents/{{name}}.md",
        },
        {
          transformer: "claude-to-gemini-root",
          match: "CLAUDE.md",
          output: "GEMINI.md",
        },
      ],
    },

    speckit: {
      pipelines: [
        {
          transformer: "identity",
          match: ".specify/**/*",
          output: "{{relativePath}}",
        },
      ],
    },
  },
};
