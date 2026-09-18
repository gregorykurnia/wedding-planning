# Wedding Files Implementation Prompt

```text
Build an MVP “Wedding Files” feature in the existing wedding-planning app.

First, inspect the current project structure, authentication, database setup, styling system, and the relevant Next.js documentation in node_modules/next/dist/docs/. Reuse existing patterns and dependencies wherever possible.

Feature requirements:

- Add a top-level navigation tab called “Files” or “Wedding Files”.
- Allow authenticated users to:
  - Create folders.
  - Create nested subfolders without a fixed depth limit.
  - Upload files into the currently selected folder.
  - Add a title/name and description explaining what each file is.
  - View files and folders in a simple folder-breadcrumb layout.
  - Download or open uploaded files.
  - Rename, edit descriptions, move, and delete files.
  - Rename and delete folders.
- Support common wedding-related files such as PDFs, images, documents, spreadsheets, and ZIP files.
- Show upload progress, loading states, empty states, and useful error messages.
- Make the UI responsive and consistent with the existing app design.
- Do not build advanced sharing, version history, file previews, search, or permissions yet unless the existing app already supports them.

Storage approach:

- Use Cloudinary for the actual file uploads.
- Store only file metadata in the existing database.
- Before coding, inspect whether the project already uses Firebase/Firestore or another database and follow the existing conventions.
- Store metadata such as:
  - id
  - name
  - description
  - folderId
  - cloudinary public ID
  - secure URL
  - original filename
  - file type
  - file size
  - uploadedBy
  - createdAt
  - updatedAt
- Use secure server-side upload handling where appropriate. Never expose Cloudinary API secrets in client-side code.
- Add only the required environment variables and document them clearly.
- Validate file type and file size on the server.
- Use stable IDs and database queries that support nested folders efficiently.

Cost and token-saving constraints:

- Keep this as a focused MVP.
- Reuse the existing UI components, auth, database helpers, and styling.
- Do not add unnecessary dependencies.
- Do not refactor unrelated parts of the app.
- Avoid polling; use existing realtime/database patterns only if already present.
- Avoid loading every file recursively at once. Load the current folder and its direct children.
- Use thumbnails or Cloudinary transformations only when needed.
- Keep Cloudinary metadata and database writes minimal.
- Prefer small, focused changes that are easy to review.

Implementation process:

1. Inspect the existing codebase and identify the best files to modify.
2. Briefly explain the proposed data model and upload flow before making changes.
3. Implement the feature in small, focused changes.
4. Add or update environment-variable documentation.
5. Add basic validation and error handling.
6. Run the relevant lint, typecheck, build, and test commands.
7. Fix any issues found.
8. Add a dated entry to the AGENTS.md change log.
9. Commit the completed work with a descriptive commit message.
10. Push the commit to the current branch’s configured upstream remote.

Acceptance criteria:

- The Files tab is visible and works for authenticated users.
- Users can create folders and nested folders.
- Users can upload a file to the selected folder through Cloudinary.
- Users can save and edit a description for each file.
- Files remain associated with the correct folder after refresh.
- Files can be opened/downloaded.
- Files and folders can be renamed and deleted.
- Unauthorized users cannot access another user’s files.
- Upload failures and invalid files show clear messages.
- The feature works on desktop and mobile.
- Existing features remain unaffected.

Do not start by implementing unrelated improvements. If Cloudinary credentials or an upload preset are missing, implement the integration using clearly documented environment variables and explain exactly what needs to be configured.
```
