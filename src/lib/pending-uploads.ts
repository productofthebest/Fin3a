// In-memory hand-off of files picked from the assistant "+" menu to the Scan documents page.
let queued: File[] = [];
export function queueUploads(files: File[]) { queued = files; }
export function takeQueuedUploads(): File[] { const f = queued; queued = []; return f; }
