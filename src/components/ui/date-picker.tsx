import { useEffect, useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id?: string; name?: string; value?: string; defaultValue?: string;
  min?: string | undefined; max?: string | undefined; onChange?: (value: string) => void;
  disabled?: boolean; required?: boolean; className?: string; "aria-label"?: string;
};
function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
}
function toDateValue(date: Date) { return format(date, "yyyy-MM-dd"); }

export function DatePicker({ id, name, value, defaultValue = "", min, max, onChange, disabled, required, className, "aria-label": ariaLabel }: DatePickerProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selectedValue = value ?? internalValue;
  const selectedDate = parseDate(selectedValue);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);
  useEffect(() => { if (value !== undefined) setInternalValue(value); }, [value]);
  function selectDate(date?: Date) {
    if (!date) return;
    const next = toDateValue(date);
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }
  return (
    <>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" disabled={disabled} aria-label={ariaLabel ?? (id ? `Choose date for ${id}` : "Choose date")} aria-haspopup="dialog" aria-expanded={open} aria-required={required}
            className={cn("mt-2 h-11 w-full justify-start gap-3 rounded-xl border-border bg-background px-3 text-left font-normal shadow-none hover:bg-accent/50 sm:w-auto sm:min-w-48", !selectedDate && "text-muted-foreground", className)}>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{selectedDate ? format(selectedDate, "PPP") : "Select a date"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-white p-1 shadow-xl" sideOffset={4}>
          <div className="px-1.5 pb-1 pt-0.5">
            <p className="text-[11px] font-semibold">Choose a date</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a day from the calendar"}</p>
          </div>
          <Calendar mode="single" selected={selectedDate} onSelect={selectDate}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            defaultMonth={selectedDate ?? minDate ?? new Date()} captionLayout="dropdown"
            startMonth={minDate ?? new Date(new Date().getFullYear() - 100, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 20, 11)}
            className="rounded-lg p-0.5 [--cell-size:1.3rem] sm:p-1 sm:[--cell-size:1.6rem] [&_.rdp-week]:mt-1 [&_.rdp-month]:gap-1 [&_.rdp-weekday]:text-[10px]" />
          <div className="flex items-center justify-between border-t border-border px-1 pt-0.5">
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" disabled={!selectedValue} onClick={() => { if (value === undefined) setInternalValue(""); onChange?.(""); setOpen(false); }}>Clear</Button>
            <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => selectDate(new Date())} disabled={(!!minDate && new Date() < minDate) || (!!maxDate && new Date() > maxDate)}>Today</Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
