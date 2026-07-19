import React from "react";

interface SehrLiveLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "custom";
  customSizeClass?: string;
  showText?: boolean;
  textPosition?: "right" | "bottom";
  className?: string;
  animate?: boolean;
}

export const SehrLiveLogo: React.FC<SehrLiveLogoProps> = ({
  size = "md",
  customSizeClass = "",
  showText = false,
  textPosition = "right",
  className = "",
  animate = true,
}) => {
  // Determine icon size
  const iconSizeMap = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-24 h-24",
    xl: "w-36 h-36",
    custom: customSizeClass,
  };

  const iconClass = iconSizeMap[size];

  // Animated pulse / glow classes
  const pulseClass = animate ? "animate-pulse" : "";
  const spinSlowClass = animate ? "animate-spin-slow" : "";

  return (
    <div
      className={`inline-flex items-center justify-center ${
        textPosition === "bottom" ? "flex-col space-y-3" : "space-x-3.5"
      } ${className}`}
    >
      {/* Dynamic SVG Icon */}
      <div className={`relative ${iconClass} flex items-center justify-center select-none`}>
        {/* Glow behind the logo */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#ff007f] via-[#7b2cbf] to-[#00f5ff] rounded-[30%] opacity-20 blur-md pointer-events-none"></div>
        
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_10px_rgba(255,0,127,0.35)]"
        >
          <defs>
            {/* Primary Pink to Purple to Cyan gradient */}
            <linearGradient id="sehrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="60%" stopColor="#7b2cbf" />
              <stop offset="100%" stopColor="#00f5ff" />
            </linearGradient>

            {/* Glowing Border Gradient */}
            <linearGradient id="sehrBorderGrad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f5ff" />
              <stop offset="50%" stopColor="#7b2cbf" />
              <stop offset="100%" stopColor="#ff007f" />
            </linearGradient>

            <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Rounded-Squircle Backplate */}
          <rect
            x="3"
            y="3"
            width="94"
            height="94"
            rx="28"
            fill="#09090e"
            stroke="url(#sehrBorderGrad)"
            strokeWidth="2.5"
            className="transition-all duration-300"
          />

          {/* Outer rotating decorative dot rings for live broadcasting accent */}
          {animate && (
            <circle
              cx="50"
              cy="50"
              r="41"
              stroke="url(#sehrGrad)"
              strokeWidth="1"
              strokeDasharray="6, 12"
              className="origin-center animate-spin-slow opacity-35"
              style={{ animationDuration: "16s" }}
            />
          )}

          {/* Stylized Modern S Shape */}
          {/* S curve part 1 (Top hook and curve) */}
          <path
            d="M 68 28 C 68 22, 32 20, 28 32 C 24 44, 48 46, 48 52 C 48 58, 32 60, 32 54"
            stroke="url(#sehrGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            opacity="0.15"
          />

          {/* Real High-Tech Stylized "S" Polygon ribbon */}
          <path
            d="M 70 30 
               C 70 20, 30 20, 30 32 
               C 30 42, 50 42, 50 48 
               C 50 54, 40 56, 32 54"
            stroke="url(#sehrGrad)"
            strokeWidth="8.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 30 70 
               C 30 80, 70 80, 70 68 
               C 70 58, 50 58, 50 52 
               C 50 46, 60 44, 68 46"
            stroke="url(#sehrGrad)"
            strokeWidth="8.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Glowing Play Symbol in Center */}
          <g filter="url(#logoGlow)">
            {/* Soft inner triangle shadow */}
            <polygon
              points="44,38 64,50 44,62"
              fill="#09090e"
            />
            {/* Pink-to-purple play triangle */}
            <polygon
              points="45,40 61,50 45,60"
              fill="url(#sehrGrad)"
              className="origin-center transition-transform hover:scale-110"
            />
          </g>

          {/* Tiny broadcasting signal wave */}
          <path
            d="M 68,43 C 71,46 71,54 68,57"
            stroke="#00f5ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            className="animate-pulse"
          />
        </svg>

        {/* Live Red Indicator Dot */}
        <span className="absolute top-1 right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff007f] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff007f] border border-[#09090e]"></span>
        </span>
      </div>

      {/* Dynamic Text Branding */}
      {showText && (
        <div className={textPosition === "bottom" ? "text-center" : "text-left"}>
          <h1
            className={`font-black tracking-widest text-white uppercase font-sans ${
              size === "sm"
                ? "text-sm"
                : size === "md"
                ? "text-lg"
                : size === "lg"
                ? "text-3xl"
                : "text-4xl"
            }`}
          >
            SEHR{" "}
            <span className="bg-gradient-to-r from-[#ff007f] via-[#7b2cbf] to-[#00f5ff] bg-clip-text text-transparent">
              LIVE
            </span>
          </h1>
          <p className="text-[7.5px] text-[#00f5ff] font-bold tracking-[0.3em] uppercase font-mono mt-0.5 whitespace-nowrap">
            Broadcasting Hearts • Connecting Stars
          </p>
        </div>
      )}
    </div>
  );
};
