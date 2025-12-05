# Building Claude Skills: A Comprehensive Guide

Skills are modular packages that extend Claude's capabilities with specialized knowledge, workflows, and tools. Think of them as onboarding guides that transform Claude from a general-purpose agent into a specialized one equipped with procedural knowledge that no model can fully possess on its own.

## What Skills Provide

Skills serve four main purposes:

1. **Specialized workflows** — Multi-step procedures for specific domains (e.g., a PDF form-filling workflow with analyze → map → validate → fill → verify steps)
2. **Tool integrations** — Instructions for working with specific file formats or APIs
3. **Domain expertise** — Company-specific knowledge, schemas, and business logic
4. **Bundled resources** — Scripts, references, and assets for complex and repetitive tasks

## Core Design Principles

### Conciseness is Critical

The context window is shared between skills, system prompts, conversation history, and user requests. Every token counts.

The default assumption should be that Claude is already very intelligent. Only include context Claude doesn't already have. Challenge each piece of information: "Does Claude really need this explanation?" and "Does this paragraph justify its token cost?" Prefer concise examples over verbose explanations.

### Match Freedom to Fragility

Set appropriate degrees of freedom based on how error-prone or variable a task is:

| Freedom Level                                 | When to Use                                                              | Example                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- |
| **High** (text instructions)                  | Multiple approaches valid, decisions depend on context                   | "Use your judgment to structure the report appropriately" |
| **Medium** (pseudocode/parameterized scripts) | Preferred pattern exists with acceptable variation                       | Template with configurable sections                       |
| **Low** (specific scripts, few parameters)    | Operations are fragile, consistency critical, specific sequence required | `scripts/rotate_pdf.py` with fixed rotation logic         |

Think of Claude as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

### Progressive Disclosure

Skills use a three-level loading system to manage context efficiently:

1. **Metadata** (name + description) — Always loaded (~100 words)
2. **SKILL.md body** — Loaded when skill triggers (target <5k words)
3. **Bundled resources** — Loaded as needed by Claude (unlimited, since scripts can execute without loading into context)

This means the `description` field is the primary triggering mechanism. Claude uses only the name and description to decide whether to load a skill's full instructions.

## Skill Anatomy

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md              # Required: metadata + instructions
├── scripts/              # Optional: executable code
├── references/           # Optional: documentation loaded on-demand
└── assets/               # Optional: templates, images, fonts for output
```

### SKILL.md Structure

The SKILL.md file has two parts:

**1. YAML Frontmatter (required)**

```yaml
---
name: my-skill
description: What this skill does AND when to use it. Include specific triggers, file types, or task scenarios.
---
```

The `name` must be hyphen-case (lowercase letters, digits, hyphens only), maximum 64 characters. The `description` is critical — it's the only thing Claude sees before deciding to load the skill. Maximum 1024 characters, no angle brackets.

**2. Markdown Body (required)**

Instructions and guidance for using the skill. This content is only loaded after the skill triggers, so "When to Use This Skill" sections in the body are not helpful — put all triggering information in the description.

Keep the body under 500 lines to minimize context bloat. If approaching this limit, split content into reference files.

### Resource Directories

**scripts/** — Executable code (Python, Bash, etc.)

Use when the same code would be rewritten repeatedly or when deterministic reliability is needed. Scripts can be executed without loading into context, making them token-efficient.

Example: `scripts/rotate_pdf.py` for PDF rotation, `scripts/fill_form.py` for form processing.

**references/** — Documentation loaded into context as needed

Use for detailed information that Claude should reference while working: API documentation, database schemas, company policies, workflow guides.

Best practices:

- If files exceed ~10k words, include grep search patterns in SKILL.md
- Avoid duplication — information should live in either SKILL.md or references, not both
- For files over 100 lines, include a table of contents at the top

**assets/** — Files used in output (not loaded into context)

Use for templates, images, icons, boilerplate code, fonts, or any files that get copied or modified in the final output.

Example: `assets/logo.png`, `assets/slides_template.pptx`, `assets/hello-world/` (React boilerplate).

### What NOT to Include

Do not create extraneous documentation:

- README.md
- INSTALLATION_GUIDE.md
- QUICK_REFERENCE.md
- CHANGELOG.md

Skills should only contain information needed for Claude to do the job. No auxiliary context about creation process, setup procedures, or user-facing documentation.

## Progressive Disclosure Patterns

### Pattern 1: High-level guide with references

```markdown
# PDF Processing

## Quick start

Extract text with pdfplumber:
[code example]

## Advanced features

- **Form filling**: See [FORMS.md](references/FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](references/REFERENCE.md) for all methods
```

Claude loads reference files only when needed.

### Pattern 2: Domain-specific organization

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── references/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    └── product.md (API usage, features)
```

When a user asks about sales metrics, Claude only reads `sales.md`.

### Pattern 3: Conditional details

```markdown
## Creating documents

Use docx-js for new documents. See [DOCX-JS.md](references/DOCX-JS.md).

## Editing documents

For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](references/REDLINING.md)
**For OOXML details**: See [OOXML.md](references/OOXML.md)
```

Important: Keep references one level deep from SKILL.md. Avoid deeply nested reference chains.

## Workflow Patterns

### Sequential Workflows

For complex tasks, break operations into clear steps. Provide an overview early in SKILL.md:

```markdown
Filling a PDF form involves these steps:

1. Analyze the form (run analyze_form.py)
2. Create field mapping (edit fields.json)
3. Validate mapping (run validate_fields.py)
4. Fill the form (run fill_form.py)
5. Verify output (run verify_output.py)
```

### Conditional Workflows

For tasks with branching logic:

```markdown
1. Determine the modification type:
   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow: [steps]
3. Editing workflow: [steps]
```

## Output Patterns

### Template Pattern

For strict requirements (API responses, data formats):

```markdown
## Report structure

ALWAYS use this exact template structure:

# [Analysis Title]

## Executive summary

[One-paragraph overview of key findings]

## Key findings

- Finding 1 with supporting data
  ...
```

For flexible guidance:

```markdown
## Report structure

Here is a sensible default format, but use your best judgment:
[template with "Adjust sections as needed" guidance]
```

### Examples Pattern

When output quality depends on seeing examples, provide input/output pairs:

```markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output: feat(auth): implement JWT-based authentication
```

Examples help Claude understand desired style better than descriptions alone.

## Skill Creation Process

### Step 1: Understand with Concrete Examples

Before building, clearly understand how the skill will be used. Ask questions like:

- "What functionality should this skill support?"
- "Can you give examples of how it would be used?"
- "What would a user say that should trigger this skill?"

Conclude when you have a clear sense of the functionality the skill should support.

### Step 2: Plan Reusable Contents

Analyze each example by considering how to execute it from scratch, then identify what scripts, references, and assets would help when executing these workflows repeatedly.

| Example Query                     | Analysis                              | Resource Needed                |
| --------------------------------- | ------------------------------------- | ------------------------------ |
| "Help me rotate this PDF"         | Requires same code each time          | `scripts/rotate_pdf.py`        |
| "Build me a todo app"             | Same boilerplate HTML/React each time | `assets/hello-world/` template |
| "How many users logged in today?" | Need to discover table schemas        | `references/schema.md`         |

### Step 3: Initialize the Skill

Run the initialization script:

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

This creates:

- Skill directory at the specified path
- SKILL.md template with proper frontmatter and TODO placeholders
- Example `scripts/`, `references/`, and `assets/` directories with placeholder files

### Step 4: Implement the Skill

**Choose a structure pattern:**

| Pattern              | Best For             | Example                                                        |
| -------------------- | -------------------- | -------------------------------------------------------------- |
| Workflow-Based       | Sequential processes | Steps: Overview → Decision Tree → Step 1 → Step 2...           |
| Task-Based           | Tool collections     | Sections: Quick Start → Merge PDFs → Split PDFs → Extract Text |
| Reference/Guidelines | Standards or specs   | Sections: Guidelines → Specifications → Usage                  |
| Capabilities-Based   | Integrated systems   | Sections: Core Capabilities → Feature 1 → Feature 2...         |

Patterns can be mixed. Most skills combine approaches.

**Implement resources first:**

Start with the reusable resources identified in Step 2. This may require user input (e.g., brand assets, documentation).

Test added scripts by actually running them to ensure they work correctly. For many similar scripts, test a representative sample.

Delete any example files not needed for the skill.

**Write SKILL.md:**

- Use imperative/infinitive form ("Extract text" not "Extracting text")
- Put all triggering information in the description, not the body
- Reference bundled resources clearly, describing when to use each
- Keep under 500 lines

### Step 5: Package the Skill

Run the packaging script:

```bash
scripts/package_skill.py <path/to/skill-folder> [output-directory]
```

This automatically validates the skill first, checking:

- YAML frontmatter format and required fields
- Naming conventions (hyphen-case, max 64 chars)
- Description completeness (max 1024 chars, no angle brackets)
- Directory structure

If validation passes, it creates a `.skill` file (zip format) containing all files with proper structure.

### Step 6: Iterate

After testing the skill on real tasks:

1. Notice struggles or inefficiencies
2. Identify how SKILL.md or resources should be updated
3. Implement changes
4. Re-package and test again

## Validation Rules Summary

| Field         | Requirements                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `name`        | Required. Hyphen-case (lowercase, digits, hyphens). Max 64 chars. No leading/trailing/consecutive hyphens. |
| `description` | Required. String. Max 1024 chars. No angle brackets.                                                       |
| SKILL.md      | Must exist. Must start with `---` frontmatter.                                                             |
| Frontmatter   | Only allowed keys: `name`, `description`, `license`, `allowed-tools`, `metadata`                           |

## Example: Complete Skill Structure

```
pdf-editor/
├── SKILL.md
├── scripts/
│   ├── rotate_pdf.py
│   ├── merge_pdfs.py
│   └── extract_text.py
├── references/
│   ├── form_filling.md
│   └── api_reference.md
└── assets/
    └── watermark_template.png
```

**SKILL.md:**

```markdown
---
name: pdf-editor
description: PDF manipulation including rotation, merging, splitting, text extraction, and form filling. Use when working with PDF files for editing, combining documents, extracting content, or filling forms programmatically.
---

# PDF Editor

## Quick Reference

| Task         | Method                        |
| ------------ | ----------------------------- |
| Rotate pages | Run `scripts/rotate_pdf.py`   |
| Merge files  | Run `scripts/merge_pdfs.py`   |
| Extract text | Run `scripts/extract_text.py` |

## Form Filling

For filling PDF forms, see [form_filling.md](references/form_filling.md).

## Workflow: Batch Processing

1. Identify input files
2. Determine operation type
3. Run appropriate script
4. Verify output
```

This structure keeps the main SKILL.md lean while providing detailed guidance in reference files that load only when needed.
