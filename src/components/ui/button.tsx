import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Focus ring comes from the global :focus-visible rule in globals.css (one consistent, high-contrast indicator).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-card hover:bg-brand-800",
        outline:
          "border-slate-300 bg-card text-foreground shadow-card hover:border-slate-400 hover:bg-slate-50 aria-expanded:bg-slate-50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-slate-200 aria-expanded:bg-slate-200",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-foreground aria-expanded:bg-slate-100",
        /** Soft destructive: for triggers that open a confirmation. */
        destructive: "border-red-200 bg-red-50 text-destructive hover:bg-red-100",
        /** Solid destructive: for the final confirm action. */
        danger: "bg-destructive text-white shadow-card hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 pointer-coarse:min-h-11",
        xs: "h-7 px-2 text-xs pointer-coarse:min-h-10 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-[0.8125rem] pointer-coarse:min-h-10 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4 text-[0.9375rem] pointer-coarse:min-h-11",
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs": "size-7",
        "icon-sm": "size-8 pointer-coarse:size-10",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
