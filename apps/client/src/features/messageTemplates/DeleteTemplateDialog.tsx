// Obsolete after the backend refactor (main, PR #16 on the backend side):
// `DELETE /message-templates/:id` was removed along with create/update/
// activate — deleting one of the 4 fixed rows would leave a message type
// with nothing to render and no way to recreate it outside a migration.
// See messageTemplatesApi.ts and apps/client/docs/DESIGN_TOKENS.md
// "Known design/backend gaps".
//
// Kept as an empty file rather than deleted — this project's workspace
// folder doesn't allow renaming/deleting files (same constraint noted in
// components/layout/Header.tsx and features/auth/ChangePasswordDialog.tsx).
export {};
