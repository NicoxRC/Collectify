// Obsolete after the backend refactor (main, PR #16 on the backend side):
// `isActive` and `POST /message-templates/:id/activate` were both
// removed — there's exactly one template per message type now (`type` is
// UNIQUE), so "activating" one no longer means anything. See
// messageTemplatesApi.ts and apps/client/docs/DESIGN_TOKENS.md "Known
// design/backend gaps".
//
// Kept as an empty file rather than deleted — this project's workspace
// folder doesn't allow renaming/deleting files (same constraint noted in
// components/layout/Header.tsx and features/auth/ChangePasswordDialog.tsx).
export {};
