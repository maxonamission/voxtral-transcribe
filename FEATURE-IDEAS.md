# Feature Ideas

Items below are "could have" ideas — not part of current epics/stories.

---

## Voice-triggered AI generation

Use a voice command to generate content inline and insert it into the active
note. This extends the existing voice command system with a new `generate` type
alongside the current `insert` and `slot` types.

### Variants

1. **Image generation**
   Generate an image from a spoken prompt (e.g. "genereer een afbeelding van
   een architectuurdiagram") via Pixtral or another image-capable model. Save
   the image to the vault and embed it in the note.

2. **Code block generation**
   Generate a fenced code block from a spoken description. Useful for:
   - Code examples and design patterns
   - DataviewJS queries (`dataviewjs` blocks)
   - Mermaid diagrams (`mermaid` blocks)
   - Templater / Obsidian plugin snippets

   The code markup (` ```lang ... ``` `) already exists in the formatting layer;
   this feature adds AI generation of the content inside it.

### Open questions

- New voice command type (`generate`) or subtypes (`generate-image`,
  `generate-code`)?
- Model selection: separate setting per generation type, or reuse the
  correction model for code and a vision model for images?
- How to pass context: include surrounding note text as context for the
  generation prompt?
- Language handling: translate the spoken prompt or pass through as-is?
- Image storage: vault subfolder, naming convention, max resolution?
- Code output: auto-detect language/block type from the prompt, or require the
  user to specify ("genereer een mermaid diagram van …")?
