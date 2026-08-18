import { useEscapeKey } from '@/lib/useEscapeKey';

interface ImageLightboxProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

// Phase 12's click-to-enlarge view for a payment's receipt photo
// (originally a local component inside LoanDetailPage.tsx) — extracted
// into a shared component in Phase 21, which reuses it for the client's ID
// document/selfie/consent-evidence photos and the loan's co-debtor ID
// photo (docs/phasesClient/PHASE_21_CLIENT_PROFILE.md: "extract into a
// small shared component instead of copy-pasting a second time"). Its own
// component (not inline JSX) so useEscapeKey only attaches its listener
// while the lightbox is actually mounted, same pattern as every other
// dialog in this app.
export function ImageLightbox({ imageUrl, alt, onClose }: ImageLightboxProps) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt={alt}
        className="max-h-[85vh] max-w-[85vw] rounded border border-border object-contain"
        // Prevents a click on the image itself from bubbling up to the
        // backdrop's onClose — otherwise there'd be no way to right-click
        // or select the image without immediately closing the lightbox.
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
