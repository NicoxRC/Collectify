// Obsolete after the backend refactor (main, PR #16 on the backend side):
// message templates are no longer admin-editable — content is fixed per
// type, changed only via migration (docs/DATABASE.md "Changed after Phase
// 9"). This form (create/edit, with variable-insertion buttons and a
// live preview) had no backing endpoint left (POST/PATCH /message-
// templates were both removed), so MessageTemplatesPage.tsx no longer
// renders it.
//
// Kept as an empty file rather than deleted — this project's workspace
// folder doesn't allow renaming/deleting files (same constraint noted in
// components/layout/Header.tsx and features/auth/ChangePasswordDialog.tsx).
// See apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
export {};
