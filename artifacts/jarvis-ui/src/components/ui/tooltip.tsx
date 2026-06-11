import * as TooltipPrimitive from "@radix-ui/react-tooltip";
  import { cn } from "@/lib/utils";

  export const TooltipProvider = TooltipPrimitive.Provider;
  export const Tooltip = TooltipPrimitive.Root;
  export const TooltipTrigger = TooltipPrimitive.Trigger;

  export function TooltipContent({
    className,
    sideOffset = 4,
    ...props
  }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={sideOffset}
          className={cn(
            "z-50 rounded-md bg-[hsl(220_50%_10%)] border border-[rgba(0,212,255,0.2)] px-3 py-1.5 text-sm text-white shadow-md",
            className
          )}
          {...props}
        />
      </TooltipPrimitive.Portal>
    );
  }
  