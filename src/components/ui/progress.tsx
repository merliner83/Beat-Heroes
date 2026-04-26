
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // Berechnung der Hintergrundgröße, damit der Gradient immer die volle Breite des Containers einnimmt
  // unabhängig von der aktuellen Breite des Indicators.
  const progressValue = value || 0;
  const backgroundSize = progressValue > 0 ? `${(100 / progressValue) * 100}% 100%` : "100% 100%";

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-white/5 border border-white/5",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 transition-all duration-1000 ease-in-out"
        style={{ 
          width: `${progressValue}%`,
          background: 'linear-gradient(90deg, #FF3D00 0%, #FF9100 33%, #FFEA00 66%, #00E676 100%)',
          backgroundSize: backgroundSize,
          backgroundPosition: 'left center'
        }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
