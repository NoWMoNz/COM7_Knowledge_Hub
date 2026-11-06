import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 py-1 text-sm text-foreground shadow-card transition-[border-color,box-shadow] duration-150 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:border-slate-500 focus-visible:border-brand-600 focus-visible:shadow-[0_0_0_4px_rgb(92_185_70/0.18)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
