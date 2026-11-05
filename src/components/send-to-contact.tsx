import { useEffect, useState } from "react";
import { BookmarkPlus, ContactRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { contactIdentifiers, recipientStorageKey, savedRecipientIds, type PhoneContact } from "@/lib/contact-recipients";
import type { ResolvedParticipant } from "@/lib/share-split.functions";

interface ContactPicker {
  select: (properties: string[], options: { multiple: boolean }) => Promise<PhoneContact[]>;
}

export function SendToContact({ onSelect, recipients = [], disabled = false }: {
  onSelect: (identifier: string) => void;
  recipients?: ResolvedParticipant[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"phone" | "saved">("phone");
  const [identifier, setIdentifier] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    let revision = 0;
    function load(userId: string | null) {
      if (!mounted) return;
      setOwner(userId); setSaved([]); setChoices([]); setIdentifier(""); setOpen(false);
      if (!userId) return;
      try { setSaved(savedRecipientIds(JSON.parse(localStorage.getItem(recipientStorageKey(userId)) ?? "[]"))); }
      catch { /* Unavailable or malformed storage must never prevent sending. */ }
    }
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        revision++; load(session?.user.id ?? null);
      }
    });
    const currentRevision = revision;
    void supabase.auth.getUser().then(({ data }) => {
      if (revision === currentRevision) load(data.user?.id ?? null);
    }).catch(() => {});
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  function persist(ids: string[]) {
    if (!owner) return;
    try {
      const next = savedRecipientIds(ids);
      localStorage.setItem(recipientStorageKey(owner), JSON.stringify(next));
      setSaved(next);
    } catch { toast.error("Could not save contacts on this device."); }
  }

  function choose(value: string) {
    if (disabled || !owner) return;
    setOpen(false); setChoices([]); setIdentifier("");
    // Every selection passes through the existing authenticated account lookup.
    onSelect(value);
  }

  async function pickPhone() {
    const picker = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
    if (!picker || !window.isSecureContext || window.top !== window.self) {
      toast.info("Phone contacts are unavailable in this browser. Enter a phone number or email below.");
      return;
    }
    setSelecting(true);
    try {
      const values = contactIdentifiers(await picker.select(["tel", "email"], { multiple: false }));
      if (values.length === 1 && values[0]) choose(values[0]);
      else if (values.length > 1) setChoices(values);
      else toast.info("No phone number or email was selected.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Could not open phone contacts. Enter a phone number or email instead.");
    } finally { setSelecting(false); }
  }

  return <>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled || !owner} onClick={() => setOpen(true)}>
        <ContactRound className="size-4" /> Send to contact
      </Button>
      {recipients.filter(person => person.fin3a_id && !saved.includes(person.fin3a_id)).map(person =>
        <Button key={person.user_id} type="button" variant="ghost" size="sm" disabled={disabled || !owner}
          onClick={() => { if (person.fin3a_id) { persist([...saved, person.fin3a_id]); toast.success("Recipient saved on this device."); } }}>
          <BookmarkPlus className="size-4" /> Save {person.fin3a_id}
        </Button>)}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Send to contact</DialogTitle><DialogDescription>Fin3a accounts only. Confirm the matched account before payment. Saved recipients stay on this device.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Contact source">
          <Button type="button" variant={tab === "phone" ? "default" : "outline"} aria-pressed={tab === "phone"} onClick={() => setTab("phone")}>Phone contacts</Button>
          <Button type="button" variant={tab === "saved" ? "default" : "outline"} aria-pressed={tab === "saved"} onClick={() => setTab("saved")}>Saved contacts</Button>
        </div>
        {tab === "phone" ? <>
          <Button type="button" variant="outline" disabled={selecting} onClick={() => void pickPhone()}>{selecting ? <Loader2 className="size-4 animate-spin" /> : <ContactRound className="size-4" />} Choose phone contact</Button>
          {choices.map(value => <Button key={value} type="button" variant="outline" className="h-auto whitespace-normal break-all" onClick={() => choose(value)}>{value}</Button>)}
          <Label htmlFor="contact-identifier">Phone number or email</Label>
          <Input id="contact-identifier" value={identifier} maxLength={254} onChange={event => setIdentifier(event.target.value)} autoComplete="off" />
          <Button type="button" disabled={disabled || identifier.trim().length < 3} onClick={() => choose(identifier.trim())}>Find contact</Button>
        </> : saved.length ? <ul className="space-y-2">{saved.map(id => <li key={id} className="flex items-center gap-2">
          <Button type="button" variant="outline" className="min-w-0 flex-1" disabled={disabled} onClick={() => choose(id)}>{id}</Button>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove saved contact ${id}`} title="Remove saved contact" onClick={() => persist(saved.filter(value => value !== id))}><Trash2 className="size-4" /></Button>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">No saved recipients yet.</p>}
      </DialogContent>
    </Dialog>
  </>;
}