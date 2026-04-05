import React from "react";
import territorialBrand from "../../assets/branding/territorial-brand.svg";

export const TerritorialBrandLogo = ({ className = "", alt = "Territorial" }: { className?: string; alt?: string }) => (
  <img src={territorialBrand} alt={alt} className={className} />
);
