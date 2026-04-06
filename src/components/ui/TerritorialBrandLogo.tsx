import React from "react";
import territorialLogo from "../../assets/branding/territorial-logo.png";

export const TerritorialBrandLogo = ({ className = "", alt = "Territorial: Geopolitical Domination" }: { className?: string; alt?: string }) => (
  <img src={territorialLogo} alt={alt} className={className} />
);
