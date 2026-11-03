import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Shared frame and intrinsic sizing content; no hard-coded card height.
export function AssistantComposerFrame({ className, ...props }: ComponentProps<"form">) {
  return <form {...props} className={cn("rounded-[22px] border border-accent/40 bg-card px-4 pb-4 pt-4 shadow-[var(--shadow-lavender)] sm:px-5", className)} />;
}

export function AssistantComposerSizeReference() {
  return (
    <AssistantComposerFrame aria-hidden="true" className="invisible pointer-events-none" data-composer-size-reference>
      <textarea tabIndex={-1} readOnly rows={2} className="max-h-40 w-full resize-none bg-transparent text-sm outline-none" />
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full border border-border px-1.5 py-1">
          <span className="size-9 shrink-0" />
        </div>
        <span className="size-11" />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">Answers from your own records · not financial advice</p>
    </AssistantComposerFrame>
  );
}