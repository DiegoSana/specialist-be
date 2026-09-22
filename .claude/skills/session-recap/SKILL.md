---
name: session-recap
description: Close a working session on specialist-be by updating TODO.md ("Donde quedamos hoy" recap, checkboxes, next steps), verifying the test count, and summarizing pending frontend/admin follow-ups. Use when the user says "cerremos", "update the TODO", "recap", or before opening a PR.
---

# session-recap

1. Run `npm test -- --silent 2>&1 | tail -5` and note suites/tests count.
2. `git status --short` and `git log --oneline main..HEAD` to list what changed this session.
3. Update `../TODO.md` (the global backlog in `/var/www/specialist/`, **not** a local `TODO.md` in
   this repo — there isn't one; it was consolidated into the global file on 2026-09-16, see that
   file's header). Under the "🔧 Tareas Pendientes - Specialist Backend" section:
   - Bump "Última actualización" date (YYYY-MM-DD).
   - In "📌 Donde quedamos hoy": add a dated "✅ Hecho (<date>)" block with 3-6 bullets (what,
     where: file paths), move finished items from "⬜ Siguiente" to done, add new next steps.
   - Tick checkboxes in the detailed sections; keep the "Archivos clave para seguir" table current.
   - Update the "Tests: N pasando" figure.
4. If any endpoint/permission/schema changed, confirm the matching docs were updated
   (`.claude/rules/08-docs-and-backlog.md` table); list anything left undone explicitly.
5. List follow-ups for the sibling repos (`specialist-fe`, `specialist-admin`, `specialist-shared`)
   as bullets in `../TODO.md` under their own sections (do not edit those repos).
6. If asked to commit: Conventional Commit with scope (`docs(todo): recap <date>` or the feature
   scope), branch off `main` as `feat/<topic>` if on `main`.
