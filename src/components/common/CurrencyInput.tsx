import React from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  currencySymbol: string;
  className?: string;
  containerClassName?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  currencySymbol,
  className = '',
  containerClassName = 'w-full',
  ...inputProps
}) => (
  <div className={`relative min-w-0 ${containerClassName}`}>
    <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-xs font-mono text-zinc-500">
      {currencySymbol}
    </span>
    <input {...inputProps} className={`${className} pl-8`} />
  </div>
);
