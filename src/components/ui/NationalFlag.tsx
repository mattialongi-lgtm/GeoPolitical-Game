import React, { useState } from "react";

export const NationalFlag = ({ iso2, className = "w-[1.2em] h-[0.9em]", style }: { iso2: string; className?: string; style?: React.CSSProperties }) => {
  const [error, setError] = useState(false);
  const upper = (iso2 || '').toUpperCase();
  const countryCode = (upper.includes('-') ? upper.split('-')[0] : upper).toLowerCase();
  
  if (!countryCode || countryCode === 'st' || countryCode === 'world' || error) {
    return <span className={className} style={{...style, fontSize: '1em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>🌍</span>;
  }

  return (
    <img
      src={`https://flagcdn.com/${countryCode}.svg`}
      className={`inline-block object-cover rounded-sm shadow-sm align-middle ${className}`}
      alt={iso2}
      style={style}
      onError={() => setError(true)}
    />
  );
};
