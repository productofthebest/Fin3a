export function canTransfer(amount: number, available: number, recipientCount: number) {
  return recipientCount === 1 && Number.isFinite(amount) && amount > 0 && amount <= available;
}