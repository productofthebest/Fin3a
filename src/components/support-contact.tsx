export const SUPPORT_EMAIL = "support@topfloorr.com";

export function SupportContact({ className }: { className?: string }) {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      aria-label="Email Fin3a support"
      className={className}
    >
      Contact support: {SUPPORT_EMAIL}
    </a>
  );
}
