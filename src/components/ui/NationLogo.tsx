import React from "react";
import { NationalFlag } from "./NationalFlag";

export const NationLogo = ({ iso2, logo, className = "w-10 h-6", style }: { iso2?: string; logo?: string | null; className?: string; style?: React.CSSProperties }) => {
  if (logo && logo.startsWith("http")) {
    return <img src={logo} alt={iso2 || "logo"} className={`object-cover rounded-none ${className}`} style={style} />;
  }
  if (logo && logo.length > 0 && logo.length <= 4) {
    return <span className={`flex items-center justify-center text-xl ${className}`} style={style}>{logo}</span>;
  }
  return <NationalFlag iso2={iso2 || "it"} className={className} style={style} />;
};
