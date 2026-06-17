"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export interface SearchableSelectOption {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: SearchableSelectOption[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
    name?: string; // Add this
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "اختر...",
    searchPlaceholder = "ابحث...",
    emptyMessage = "لم يتم العثور على خيارات.",
    className,
    name,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false);

    const selectedOption = options.find((option) => option.value === value);

    const normalize = (text: string) => {
        return text.toLowerCase()
            .replace(/[آأإ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .trim();
    };

    // Memoize/cache normalization values to avoid heavy calls in filter loops
    const lastSearchRef = React.useRef({ original: "", normalized: "" });
    const normalizedCacheRef = React.useRef<Record<string, string>>({});

    const getNormalizedSearch = (search: string) => {
        if (lastSearchRef.current.original === search) {
            return lastSearchRef.current.normalized;
        }
        const normalized = normalize(search);
        lastSearchRef.current = { original: search, normalized };
        return normalized;
    };

    const getNormalizedValue = (val: string) => {
        let cached = normalizedCacheRef.current[val];
        if (cached === undefined) {
            cached = normalize(val);
            normalizedCacheRef.current[val] = cached;
        }
        return cached;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", className)}
                >
                    {selectedOption ? selectedOption.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            {/* Hidden input for form submission support */}
            <input type="hidden" name={name} value={value} />
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command
                    className="w-full"
                    filter={(val, search) => {
                        const normSearch = getNormalizedSearch(search);
                        const normVal = getNormalizedValue(val);
                        return normVal.includes(normSearch) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyMessage}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label + " " + option.value}
                                    onSelect={() => {
                                        onValueChange(option.value === value ? "" : option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
