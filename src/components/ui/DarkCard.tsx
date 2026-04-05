import React from "react";

export const DarkCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 ${className}`}>
    {children}
  </div>
);
