/** The foodprice mark: a yellow shelf tag with a punched hole and a leaf. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect x="3" y="7" width="34" height="26" rx="6" fill="var(--tag)" transform="rotate(-8 20 20)" />
      <circle cx="10.5" cy="14.5" r="2.4" fill="var(--shell)" />
      <path
        d="M16 27.5c.6-6.4 4.6-10.6 13-11.6-.4 7.6-4.8 12-13 11.6Z"
        fill="var(--member)"
        stroke="var(--shell)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M17.5 26.5c2.6-3.1 5.4-5 8.5-6.4" stroke="var(--shell)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
