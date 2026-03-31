import React from "react";

interface WarFactionBadgeProps {
  name?: string | null;
  icon?: string | null;
  align?: "left" | "right" | "center";
  iconSizeClass?: string;
  textClassName?: string;
  className?: string;
}

const isImageSrc = (value: string) =>
  /^https?:\/\//i.test(value) || value.startsWith("data:image/");

const isShortToken = (value: string) => value.length <= 4;

export const WarFactionBadge: React.FC<WarFactionBadgeProps> = ({
  name,
  icon,
  align = "left",
  iconSizeClass = "w-6 h-6",
  textClassName = "text-sm font-black",
  className = "",
}) => {
  const displayName = name || "Sconosciuto";
  const alignClass =
    align === "right" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "justify-start text-left";
  const emojiClass = iconSizeClass.includes("w-10")
    ? "text-3xl"
    : iconSizeClass.includes("w-8") || iconSizeClass.includes("w-7")
      ? "text-2xl"
      : iconSizeClass.includes("w-5")
        ? "text-lg"
        : "text-base";

  let iconNode: React.ReactNode = null;
  if (icon && isImageSrc(icon)) {
    iconNode = (
      <img
        src={icon}
        alt={displayName}
        className={`object-cover rounded-sm shadow-sm ${iconSizeClass}`}
      />
    );
  } else if (icon && isShortToken(icon)) {
    iconNode = (
      <span className={`flex items-center justify-center leading-none ${iconSizeClass}`}>
        <span className={emojiClass}>{icon}</span>
      </span>
    );
  } else {
    iconNode = (
      <span
        className={`flex items-center justify-center rounded-md bg-slate-200/60 text-slate-500 font-black ${iconSizeClass}`}
      >
        ?
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${alignClass} ${className}`}>
      {iconNode}
      <span className={`truncate ${textClassName}`} title={displayName}>
        {displayName}
      </span>
    </div>
  );
};
