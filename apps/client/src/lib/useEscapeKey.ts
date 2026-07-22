import { useEffect } from 'react';

// Shared across every modal/dialog/drawer in the app (ClientForm,
// DeactivateClientDialog, LoanForm, MarkAsPaidDialog, RegisterPaymentDialog,
// MessageTemplateForm, ActivateTemplateDialog, DeleteTemplateDialog,
// MessageLogDrawer) so Escape closes whichever one is open — a single
// listener per open dialog, removed on unmount.
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape]);
}
