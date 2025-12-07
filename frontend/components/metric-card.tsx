// components/metric-card.tsx
"use client";

import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon, 
  className = "",
  children 
}: MetricCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-700 dark:text-green-200" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-700 dark:text-red-200" />;
      default:
        return <Minus className="w-4 h-4 text-gray-700 dark:text-gray-200" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-700 bg-green-100 dark:text-green-200 dark:bg-green-500/30';
      case 'down':
        return 'text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-500/30';
      default:
        return 'text-gray-700 bg-gray-100 dark:text-gray-200 dark:bg-gray-500/30';
    }
  };

  return (
    <Card className={`group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl dark:shadow-2xl transition-all duration-500 overflow-hidden ${className}`}
          style={{ background: 'var(--card)', backdropFilter: 'blur(12px)' }}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
           style={{ background: 'var(--gradient-1)' }}>
        <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {icon && (
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white transform transition-transform duration-300 group-hover:scale-110"
                   style={{ background: 'var(--gradient-2)' }}>
                {icon}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-card-foreground text-sm">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {trend && trendValue && (
            <Badge variant="secondary" className={`${getTrendColor()} border-0 shadow-sm`}>
              {getTrendIcon()}
              <span className="ml-1 text-xs font-semibold">{trendValue}</span>
            </Badge>
          )}
        </div>
        
        <div className="space-y-3">
          <div className="text-4xl font-bold transition-all duration-300 group-hover:scale-105"
               style={{ background: 'var(--gradient-3)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {value}
          </div>
          {children}
        </div>
      </div>
    </Card>
  );
}
