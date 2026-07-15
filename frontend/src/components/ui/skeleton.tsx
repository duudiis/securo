import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Translucent so the shimmer reads as the same soft step on any surface
      // (card, popover, muted) in both themes — absolute colors went nearly
      // invisible on some dark surfaces.
      className={cn("bg-muted-foreground/10 animate-pulse [animation-duration:0.85s] rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
