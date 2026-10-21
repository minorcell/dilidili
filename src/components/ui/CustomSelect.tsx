import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  filesize?: number;
}

interface CustomSelectProps {
  options: SelectOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = '请选择...',
  className = '',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<SelectOption | null>(
    value !== undefined ? options.find((option) => option.value === value) || null : null,
  );

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectOption = (option: SelectOption) => {
    setSelectedOption(option);
    onChange(option.value);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen((open) => !open);
    }
  };

  const rect = isOpen && dropdownRef.current ? dropdownRef.current.getBoundingClientRect() : null;

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          disabled
            ? 'cursor-not-allowed border-line bg-subtle text-subtle-fg opacity-60'
            : isOpen
              ? 'border-accent bg-canvas text-fg ring-2 ring-accent/30'
              : 'border-line bg-subtle text-fg hover:bg-neutral-subtle',
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selectedOption ? (
            <>
              <span className="truncate font-medium">{selectedOption.label}</span>
              {selectedOption.filesize ? (
                <span className="shrink-0 text-xs text-muted">
                  {(selectedOption.filesize / 1024 / 1024).toFixed(1)} MB
                </span>
              ) : null}
            </>
          ) : (
            <span className="truncate text-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="fixed z-[9999] animate-menu-in overflow-hidden rounded-md border border-line bg-canvas shadow-lg"
          style={{
            top: rect ? rect.bottom + 4 : 0,
            left: rect ? rect.left : 0,
            width: rect ? rect.width : 'auto',
            maxHeight: '320px',
          }}
        >
          <div className="custom-scrollbar max-h-80 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = selectedOption?.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
                    isSelected ? 'bg-subtle' : 'hover:bg-subtle',
                  )}
                >
                  <Check
                    size={14}
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 shrink-0',
                      isSelected ? 'text-accent-fg' : 'text-transparent',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate text-sm font-medium text-fg">{option.label}</span>
                      {option.filesize ? (
                        <span className="text-xs text-muted">
                          {(option.filesize / 1024 / 1024).toFixed(1)} MB
                        </span>
                      ) : null}
                    </span>
                    {option.description && (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
