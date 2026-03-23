import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-sm bg-surface-lo px-4 py-3.5 font-sans text-sm text-text-body transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:font-serif placeholder:italic placeholder:text-text-ghost focus-visible:bg-surface-mid focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
