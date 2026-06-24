export const svgColorFromAgentColor = (color: string | undefined, fallback: string) => {
  if (!color) return fallback;
  const normalized = color.trim().toLowerCase();
  if (/^(#|rgb|hsl)/.test(normalized)) return color;

  const palette: Record<string, string> = {
    amber: "#F59E0B",
    blue: "#3B82F6",
    cyan: "#06B6D4",
    emerald: "#10B981",
    fuchsia: "#D946EF",
    gray: "#6B7280",
    green: "#22C55E",
    indigo: "#6366F1",
    lime: "#84CC16",
    neutral: "#737373",
    orange: "#F97316",
    pink: "#EC4899",
    purple: "#A855F7",
    red: "#EF4444",
    rose: "#F43F5E",
    sky: "#0EA5E9",
    slate: "#64748B",
    stone: "#78716C",
    teal: "#14B8A6",
    violet: "#8B5CF6",
    yellow: "#EAB308",
    zinc: "#71717A",
  };

  for (const [token, value] of Object.entries(palette)) {
    if (normalized.includes(token)) return value;
  }

  return fallback;
};
