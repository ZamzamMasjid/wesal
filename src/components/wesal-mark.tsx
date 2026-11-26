// The mark half of the Wesal wordmark (docs/design/system.md, "Wordmark and
// icon"): a mihrab arch with a niche cut out of it. One shape, so it stays
// readable at favicon sizes. The outer arch inherits the text colour; the niche
// takes the page background, or the brand on top of a photograph.
export function WesalMark({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "photo";
}) {
  return (
    <svg viewBox="0 0 88 88" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 88V48C6 24 23 6 44 4c21 2 38 20 38 44v40H6Z"
      />
      <path
        fill={tone === "photo" ? "var(--color-brand)" : "var(--color-bg)"}
        d="M22 88V51c0-17 9-30 22-37 13 7 22 20 22 37v37H22Z"
      />
    </svg>
  );
}
