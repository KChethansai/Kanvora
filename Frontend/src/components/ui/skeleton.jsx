// Adapted from the shadcn/ui "skeleton" registry item (MIT, (c) shadcn).
// Source: https://ui.shadcn.com/r/styles/new-york/skeleton.json
//
// The upstream item is a single pulsing div. This port keeps that shape and
// adds the two things the application needs: the pulse colour comes from the
// app token (so a skeleton follows the active theme in light and dark), and
// the element is decorative, so a screen reader skips it instead of reading
// a placeholder as content.
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-[var(--kt-surface-soft)] ${className}`}
      {...props}
    />
  )
}
