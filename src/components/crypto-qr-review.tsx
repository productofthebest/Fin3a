import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CryptoQr } from "@/lib/crypto-qr";

export function CryptoQrReview({ value, onClose }: { value: CryptoQr | null; onClose: () => void }) {
  return <Dialog open={value !== null} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-md">
    <DialogHeader><DialogTitle>Crypto address detected</DialogTitle><DialogDescription>Address recognition is not proof of ownership or payment support.</DialogDescription></DialogHeader>
    {value && <>
      <dl className="space-y-3 text-sm">
        <div><dt className="text-muted-foreground">Address format</dt><dd>{value.family}{value.asset ? ` · ${value.asset}` : " · Coin and network must be verified"}</dd></div>
        <div><dt className="text-muted-foreground">Scanned address</dt><dd className="break-all font-mono text-xs">{value.address}</dd></div>
        {value.chainId && <div><dt className="text-muted-foreground">QR chain ID (unverified support)</dt><dd>{value.chainId}</dd></div>}
        {value.tokenContract && <div><dt className="text-muted-foreground">QR token contract (unverified asset)</dt><dd className="break-all font-mono text-xs">{value.tokenContract}</dd></div>}
      </dl>
      <p className="text-sm text-muted-foreground">This is an external address, not a verified Fin3a deposit address. Do not send a deposit to it. Withdrawals are USDC or USDT only and remain unavailable until payment support is verified.</p>
      <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />No payment was created. Scanned details stay on this device and are not sent to AI.</p>
      <Button asChild><Link to="/accounts/actions" onClick={onClose}>Open account details</Link></Button>
      <Button variant="outline" onClick={onClose}>Dismiss</Button>
    </>}
  </DialogContent></Dialog>;
}