---
title: "Contributor Onboarding & Conventions"
description: "Guidelines, markdown standards, pre-commit quality gates, and local developer setup for localpass documentation."
related_docs:
  - "docs/reference/file-index.md"
  - "docs/guides/debugging.md"
codebase_files:
  - ".pre-commit-config.yaml"
  - "requirements-docs.txt"
ai_context:
  component: "Contributor Onboarding"
  boundary: "Open Source Standards"
---

[Home](https://github.com/nishantdec/localpass/blob/main/README.md) •
[Docs Index](../index.md) •
[Quick Start](https://github.com/nishantdec/localpass/blob/main/QUICKSTART.md) •
[Glossary](../reference/glossary.md)

---

# Contributor Onboarding & Quality Standards

Welcome to the `localpass` project! This guide contains the technical standards, markdown linting protocols, directory structures, and git hooks required for developers to safely edit and extend the documentation system.

---

## 1. Local Workspace Setup {#local-setup}

To preview layout and link changes locally before committing:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/nishantdec/localpass.git
    cd localpass
    ```
2.  **Install dependencies**: Install the pinned documentation build requirements:
    ```bash
    pip install -r requirements-docs.txt
    ```
3.  **Run the local development server**:
    ```bash
    mkdocs serve
    ```
4.  **Inspect the build**: Open a browser and navigate to `http://127.0.0.1:8000`. The server dynamically observes filesystem changes and recompiles pages in under 100ms.

---

## 2. Directory & Naming Conventions {#naming-conventions}

To ensure long-term ease of maintenance and prevent folder collisions, the repository enforces a strict naming schema:

*   **Markdown Files**: Must be entirely lowercase and use hyphens for word separation (e.g. `local-server-api.md`).
*   **Media Assets**: Place screenshots under `assets/screenshots/terminal/` or `assets/screenshots/extension/`. All assets must be converted to **WebP (`.webp`)** at 80% compression and capped at a maximum width of **1200px** before committing.
*   **Mermaid Diagrams**: Must use standard process boundary subgraphs and rely on CSS variables for active styling matching the active light/dark color schemes.

---

## 3. Mandatory Frontmatter Schemas {#frontmatter-schema}

All technical documentation files MUST begin with an explicit YAML frontmatter block to ensure they are easily parsed by semantic search, AI crawlers, and RAG systems.

```yaml
---
title: "Descriptive Human-Readable Title"
description: "A single-sentence summary of the document's contents and purpose."
related_docs:
  - "docs/relative/path/to/related.md"
codebase_files:
  - "northlocker/relative/path/to/code.py"
ai_context:
  component: "Logical Component Name"
  boundary: "Process Boundary (e.g. RAM, Local Disk, Main World)"
---
```

---

## 4. Pre-Commit Quality Gates {#pre-commit}

We utilize the `pre-commit` framework to run security scans and style linters before commits are recorded.

1.  **Install pre-commit**:
    ```bash
    pip install pre-commit
    ```
2.  **Activate hooks**:
    ```bash
    pre-commit install
    ```
3.  **Active Checks**:
    *   **Trailing Whitespace**: Automatically removes trailing spaces from all files.
    *   **End of File Fixer**: Ensures a single newline at the end of files.
    *   **markdownlint**: Enforces clean Markdown formatting (e.g., proper spacing, header capitalization, no raw HTML elements).
    *   **lychee**: Fast link checker verifying no broken relative (`.md`) or remote (`http`) references.

---

## 5. Commit Standards {#commit-standards}

All commits must follow **Conventional Commits**:

```text
type(scope): description

[optional body]

[optional footer(s)]
```

### Approved Types:
*   `docs`: Documentation edits (e.g., `docs(guides): add building-exe manual`).
*   `feat`: Adding a new software feature.
*   `fix`: Resolving a bug or error.
*   `refactor`: Rewriting code without modifying features.

---

## See Also
*   [File Index Reference](../reference/file-index.md)
*   [Technical Function Index](../reference/function-index.md)
*   [Comprehensive Troubleshooting](../troubleshooting/mistakes-lessons.md)
*   [System Debugging](../guides/debugging.md)

---
*[Back to Docs Index](../index.md) •
[Back to Top](#)*
