import type { Entity } from "../lib/api";
export default function ProductImage({ medicine }: { medicine: Entity }) {
  const colors = ["#3c9b8b", "#6b86c4", "#bc9258", "#a47fac", "#d38882"];
  const seed = String(medicine.genericName || medicine.name || "")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const color = colors[seed % colors.length];
  return (
    <span className="product-image">
      <svg viewBox="0 0 100 84" aria-hidden="true">
        <ellipse cx="51" cy="76" rx="32" ry="5" fill="#dfebe8" />
        <path
          d="M20 17 72 13 83 22 82 69 30 75 19 65Z"
          fill="#f8faf9"
          stroke="#d8e3e2"
        />
        <path d="M20 17 72 13 83 22 30 27Z" fill="#eef4f1" />
        <path d="M72 13 83 22 82 69 72 62Z" fill="#dfe9e6" />
        <path d="M20 35 72 31 72 48 20 52Z" fill={color} />
        <path d="M72 31 83 38 83 55 72 48Z" fill={color} opacity=".65" />
        <path
          d="M28 59 49 57 M28 64 58 62"
          stroke="#b6c9c4"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <g transform="translate(53 48) rotate(-32)">
          <rect
            x="0"
            y="0"
            width="13"
            height="28"
            rx="6.5"
            fill="white"
            stroke={color}
            strokeWidth="1.5"
          />
          <path d="M.5 14h12v7a6 6 0 0 1-12 0z" fill={color} />
          <path
            d="M4 5v5"
            stroke="#dbe6e2"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </span>
  );
}
