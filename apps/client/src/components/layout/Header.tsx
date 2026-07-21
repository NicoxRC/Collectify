interface HeaderProps {
  title: string;
  subtitle?: string;
}

// Despite the filename (kept from Phase 1/2, before this was confirmed
// against real designs — this tool session can't rename/delete files),
// this is NOT a global app header. The real design (Figma frames
// 40:3/40:282/40:383/40:484) has no persistent top bar; every page
// composes its own title row like this one, right above its content.
// features/clients/ClientDetailPage.tsx uses a breadcrumb instead — not
// every page uses this component.
export function Header({ title, subtitle }: HeaderProps) {
  return (
    <div className="flex flex-col gap-[3px]">
      <h1 className="text-page-title font-semibold text-white">{title}</h1>
      {subtitle && <p className="text-label text-muted">{subtitle}</p>}
    </div>
  );
}
