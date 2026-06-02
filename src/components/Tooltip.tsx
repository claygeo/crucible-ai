"use client";

import { useState, useId, useEffect, useRef, type ReactNode } from "react";

export function Tooltip({
  children,
  tip,
}: {
  children: ReactNode;
  tip: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  // Close on tap outside (mobile)
  useEffect(() => {
    if (!visible) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [visible]);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center cursor-help border-b border-dotted border-[rgba(123,133,149,0.4)]"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onClick={(e) => {
        e.stopPropagation();
        setVisible((v) => !v);
      }}
      tabIndex={0}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#111317] border border-[#2a313b] rounded px-3 py-2 text-[10px] text-[#9aa4b2] mono leading-snug z-50 pointer-events-none whitespace-normal"
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
