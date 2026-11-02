import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileSpreadsheet, FileText, Plus, Receipt, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { queueUploads } from "@/lib/pending-uploads";

const OPTIONS = [
  { key: "statement", label: "Upload bank statement", hint: "PDF, CSV, Excel", accept: ".pdf,.csv,.xlsx,.xls", icon: FileSpreadsheet },
  { key: "bills", label: "Upload bills & financial documents", hint: "PDF, CSV, Excel, JPG, PNG", accept: ".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png", icon: FileText },
  { key: "receipts", label: "Upload receipts & evidence", hint: "JPG, PNG, PDF", accept: ".jpg,.jpeg,.png,.pdf", icon: Receipt },
  { key: "other", label: "Upload other financial documents", hint: "PDF, CSV, Excel, images", accept: ".pdf,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls", icon: Upload },
] as const;

/** "+" button beside the assistant input. Picked files are scanned on the Scan documents page, where every line is reviewed before import. */
export function AssistantUploadMenu({ disabled }: { disabled?: boolean }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState<string>(OPTIONS[3].accept);

  async function choose(a: string) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast.info("Sign in to upload documents — your files stay private to your account.");
      void navigate({ to: "/auth" });
      return;
    }
    setAccept(a);
    // Wait for the accept attribute to update before opening the picker.
    requestAnimationFrame(() => inputRef.current?.click());
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        aria-label="Choose financial documents"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length === 0) return;
          queueUploads(files);
          void navigate({ to: "/documents" });
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label="Attach documents" className="shrink-0 border-primary/40 text-primary hover:bg-primary/10">
            <Plus className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-72">
          <DropdownMenuLabel>Add to Fin3a</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map((o) => (
            <DropdownMenuItem key={o.key} onSelect={() => void choose(o.accept)} className="items-start gap-3 py-2">
              <o.icon className="mt-0.5 size-4 text-primary" />
              <span className="flex flex-col"><span>{o.label}</span><span className="text-xs text-muted-foreground">{o.hint} · multiple files</span></span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
