import React from 'react';
import {
  Utensils,
  Coffee,
  ShoppingCart,
  Car,
  Home,
  Film,
  ShoppingBag,
  HeartPulse,
  Laptop,
  MoreHorizontal,
  Briefcase,
  Zap,
  TrendingUp,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  Building2,
  PiggyBank,
  CircleDollarSign,
  Receipt,
  Target,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  Utensils,
  Coffee,
  ShoppingCart,
  Car,
  Home,
  Film,
  ShoppingBag,
  HeartPulse,
  Laptop,
  MoreHorizontal,
  Briefcase,
  Zap,
  TrendingUp,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  Building2,
  PiggyBank,
  CircleDollarSign,
  Receipt,
  Target,
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-4 h-4', size = 18 }) => {
  const IconComponent = ICON_MAP[name] || CircleDollarSign;
  return <IconComponent className={className} size={size} />;
};

export const formatCurrency = (amount: number, symbol = '$'): string => {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
};
