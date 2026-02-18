
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  theme?: 'light' | 'dark';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, theme = 'light' }) => {
  const isDark = theme === 'dark';
  return (
    <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-5 rounded-xl shadow-sm border flex flex-col items-start space-y-3 transition-all hover:shadow-md hover:border-amber-400/50`}>
      <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg`}>
        <span className="text-[12px]">{icon}</span>
      </div>
      <div>
        <p className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'} font-black uppercase tracking-widest leading-none mb-1.5`}>{label}</p>
        <p className={`text-[9px] font-black ${isDark ? 'text-slate-100' : 'text-[#002b5c]'} leading-none tracking-tight uppercase`}>{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
