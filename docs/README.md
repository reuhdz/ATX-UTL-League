# ATX UTL developer documentation

Developer-facing technical deep dive for the **ATX UTL Season Dashboard** static web app (`c:\Users\szfy8z\Personal_POC\ATX-UTL`).

## Contents

| File | Description |
|------|-------------|
| [atx-utl-developer-doc.xml](./atx-utl-developer-doc.xml) | Confluence Storage Format page — architecture, modules, data model, tabs, theming, deployment |
| [docx/atx-utl-developer-doc.docx](./docx/atx-utl-developer-doc.docx) | Word export (generated) — import into Confluence via **Import Word document** |
| [diagrams/](./diagrams/) | Mermaid source (`.mmd`) — topology, modules, data flow, tab nav, CI/CD, **algorithm pipeline** |

## How to use

1. **Confluence:** Import `docx/atx-utl-developer-doc.docx`, or paste/adapt the XML if your space supports Storage Format import.
2. **Local review:** Open the `.docx` in Word, or read the XML in an editor.
3. **Regenerate DOCX** (after editing XML):

   ```bash
   node "C:/Users/szfy8z/.cursor/skills/documentation-agent/scripts/convert-to-docx.js" "C:/Users/szfy8z/eMerge/Development/Repos/Summary_Learnings/atx-utl-developer-doc"
   ```

## Document parameters

- **Audience:** Developers
- **Content type:** Repo deep dive (adapted for zero-build static SPA)
- **Depth:** Standard
- **Generated:** Jul 22, 2026 (algorithms pass — § Core algorithms and logic)

## Review notes

- **Venue copy mismatch:** `LEAGUE.venue` and the footer use *Deepend Fitness* (`js/data.js`), while FAQ entry "Where does ATX UTL play?" says *Eans Aquatic Center* (`js/content.js`). Confirm which is canonical and align both files.
