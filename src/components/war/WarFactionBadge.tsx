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

const isIsoLikeCode = (value: string) => /^[A-Za-z]{2}([\-][A-Za-z0-9]{1,})?$/.test(value);

const toFlagCdnCode = (value: string) => {
  const upper = (value || "").toUpperCase();
  const country = (upper.includes("-") ? upper.split("-")[0] : upper).toLowerCase();
  return country;
};

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
  } else if (icon && isIsoLikeCode(icon)) {
    const code = toFlagCdnCode(icon);
    iconNode = (
      <img
        src={`https://flagcdn.com/${code}.svg`}
        alt={displayName}
        className={`object-cover rounded-sm shadow-sm ${iconSizeClass}`}
        onError={(e) => {
          // Avoid broken-image icon; fallback to '?' box below via src swap.
          (e.currentTarget as HTMLImageElement).src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='24'%3E%3Crect width='32' height='24' fill='%23e2e8f0'/%3E%3Ctext x='16' y='16' font-size='14' text-anchor='middle' fill='%2364748b'%3E%3F%3C/text%3E%3C/svg%3E";
        }}
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
