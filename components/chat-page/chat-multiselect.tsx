"use client";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

interface Option {
  label: string;
  value: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onSelectChange: (selectedValues: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({
  options,
  selected,
  onSelectChange,
  placeholder = "Select...",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleCheckedChange = (value: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selected, value]);
    } else {
      onSelectChange(selected.filter((item) => item !== value));
    }
  };

  const displayValue =
    selected.length > 0
      ? selected
          .map((val) => options.find((opt) => opt.value === val)?.label || val)
          .join(", ")
      : placeholder;

  // Close popover when an item is selected (optional, depends on desired UX)
  // useEffect(() => {
  //   if (selected.length > 0 && isOpen) {
  //     setIsOpen(false);
  //   }
  // }, [selected, isOpen]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
          ref={triggerRef}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <p className="p-2 text-sm text-gray-500">No options available</p>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() =>
                  handleCheckedChange(
                    option.value,
                    !selected.includes(option.value)
                  )
                }
              >
                <Checkbox
                  id={`checkbox-${option.value}`}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked: boolean) =>
                    handleCheckedChange(option.value, checked)
                  }
                />
                <label
                  htmlFor={`checkbox-${option.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
