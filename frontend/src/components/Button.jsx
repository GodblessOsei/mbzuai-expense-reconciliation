export default function Button({
  children,
  onClick,
  variant = "primary", // "primary" (gold) | "secondary" (navy) | "outline"
  disabled = false,
  type = "button",
}) {
  const base =
    "inline-flex items-center gap-3 rounded-full px-6 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-mbzuai-gold text-mbzuai-navy hover:bg-mbzuai-gold/90",
    secondary: "bg-mbzuai-navy text-white hover:bg-mbzuai-navy/90",
    outline:
      "border border-mbzuai-navy text-mbzuai-navy hover:bg-mbzuai-navy/5",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      <span>{children}</span>
      {/* circular arrow — the MBZUAI signature */}
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-mbzuai-navy text-sm">
        →
      </span>
    </button>
  );
}
