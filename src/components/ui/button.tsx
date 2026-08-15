import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-tight ring-offset-background transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-black shadow-sm hover:bg-primary/90 hover:text-black",
        destructive: "border border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:text-white",
        outline: "border border-primary bg-transparent text-primary shadow-sm hover:bg-primary hover:text-black",
        secondary: "border border-border/70 bg-secondary text-secondary-foreground shadow-sm hover:bg-primary hover:text-black",
        ghost: "border border-transparent bg-transparent text-foreground hover:bg-primary hover:text-black",
        link: "h-auto border-0 bg-transparent p-0 text-primary underline-offset-4 shadow-none hover:text-white hover:underline dark:hover:text-white",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        data-ui-button="true"
        data-variant={variant || "default"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
