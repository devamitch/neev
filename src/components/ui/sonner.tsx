import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-hi group-[.toaster]:text-text-body group-[.toaster]:border-none group-[.toaster]:shadow-lg group-[.toaster]:rounded-md",
          description: "group-[.toast]:text-text-muted",
          actionButton:
            "group-[.toast]:bg-sage group-[.toast]:text-surface-hi",
          cancelButton:
            "group-[.toast]:bg-surface-lo group-[.toast]:text-text-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
