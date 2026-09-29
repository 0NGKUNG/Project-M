import React from 'react';

export function formatNumberWithCommas(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const str = String(value);
  const isNegative = str.startsWith('-');
  const unsigned = isNegative ? str.slice(1) : str;

  const parts = unsigned.split('.');
  let integerPart = parts[0].replace(/\D/g, '');
  if (integerPart.length > 1) {
    integerPart = integerPart.replace(/^0+([1-9])/, '$1').replace(/^0+(0)$/, '$1');
  }
  const decimalPart = parts.length > 1 ? parts.slice(1).join('').replace(/\D/g, '') : undefined;

  const formattedInteger = integerPart
    ? integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : parts.length > 1
    ? '0'
    : '';

  const formatted =
    decimalPart !== undefined
      ? `${formattedInteger || '0'}.${decimalPart}`
      : parts.length > 1
      ? `${formattedInteger || '0'}.`
      : formattedInteger;

  return isNegative ? `-${formatted}` : formatted;
}

export function parseFormattedNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function formatAmountDisplay(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '0';
  const val = String(value);
  if (!/[+-]/.test(val)) {
    return formatNumberWithCommas(val);
  }

  const endsWithSpace = val.endsWith(' ');
  const parts = val.split(/([+-])/);
  const formatted = parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed === '+' || trimmed === '-') {
      return ` ${trimmed} `;
    }
    if (!trimmed) return '';
    const isTrailingDot = trimmed.endsWith('.');
    const f = formatNumberWithCommas(trimmed);
    return isTrailingDot && !f.endsWith('.') ? `${f}.` : f;
  }).join('').replace(/\s+/g, ' ').trim();

  return endsWithSpace ? `${formatted} ` : formatted;
}

export function evaluateAmountExpression(expr: string): string {
  try {
    const sanitized = expr.replace(/[^0-9.+\-]/g, '');
    if (!sanitized) return '0';
    const tokens = sanitized.match(/(\d+\.?\d*|\.\d+)|([+-])/g);
    if (!tokens || tokens.length === 0) return '0';

    let result = 0;
    let currentOp = '+';
    let startIndex = 0;

    if (tokens[0] === '+' || tokens[0] === '-') {
      currentOp = tokens[0];
      startIndex = 1;
    } else {
      result = parseFloat(tokens[0]) || 0;
      startIndex = 1;
    }

    for (let i = startIndex; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '+' || token === '-') {
        currentOp = token;
      } else {
        const val = parseFloat(token) || 0;
        if (currentOp === '+') result += val;
        if (currentOp === '-') result -= val;
      }
    }

    return String(Math.max(0, parseFloat(result.toFixed(2))));
  } catch {
    return expr;
  }
}


interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'onChange'> {
  currencySymbol: string;
  className?: string;
  containerClassName?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  currencySymbol,
  className = '',
  containerClassName = 'w-full',
  value,
  onChange,
  type: _unusedType,
  ...inputProps
}) => {
  const displayValue = formatNumberWithCommas(value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      if (start === end && start > 1 && input.value[start - 1] === ',') {
        e.preventDefault();
        const val = input.value;
        const newVal = val.slice(0, start - 2) + val.slice(start);
        const formatted = formatNumberWithCommas(newVal);

        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, formatted);
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const newPos = Math.max(0, start - 2);
        requestAnimationFrame(() => {
          input.setSelectionRange(newPos, newPos);
        });
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const raw = input.value;

    const cursor = input.selectionStart || 0;
    const digitsBefore = raw.slice(0, cursor).replace(/\D/g, '').length;
    const isDotBefore = raw.slice(0, cursor).endsWith('.');

    const formatted = formatNumberWithCommas(raw);
    e.target.value = formatted;

    if (onChange) {
      onChange(e);
    }

    requestAnimationFrame(() => {
      let counted = 0;
      let newPos = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (counted >= digitsBefore) {
          break;
        }
        if (/\d/.test(formatted[i])) {
          counted++;
        }
        newPos = i + 1;
      }
      if (isDotBefore && formatted.includes('.')) {
        newPos = formatted.indexOf('.') + 1;
      }
      input.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className={`relative min-w-0 ${containerClassName}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-xs font-mono text-zinc-500">
        {currencySymbol}
      </span>
      <input
        {...inputProps}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={`${className} pl-8`}
      />
    </div>
  );
};
