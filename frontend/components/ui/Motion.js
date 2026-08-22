"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * FadeIn component triggers a simple opacity fade-in.
 * Respects system-level prefers-reduced-motion setting.
 */
export function FadeIn({ children, duration = 0.3, delay = 0, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  const transition = shouldReduceMotion
    ? { duration: 0.05 }
    : { duration, delay, ease: "easeOut" };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reveal component triggers a vertical translation slide and fade reveal.
 * Degrades gracefully to a simple opacity shift when reduced-motion is requested.
 */
export function Reveal({ children, duration = 0.4, delay = 0, yOffset = 15, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  const initial = shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: yOffset };
  const animate = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
  const transition = shouldReduceMotion
    ? { duration: 0.05 }
    : { duration, delay, ease: [0.22, 1, 0.36, 1] }; // Standard easeOutQuint

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Expand component handles variable dynamic height expansions with ease.
 */
export function Expand({ children, isOpen, duration = 0.35, className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  const transition = shouldReduceMotion
    ? { duration: 0.05 }
    : { duration, ease: [0.22, 1, 0.36, 1] };

  return (
    <motion.div
      initial={false}
      animate={{
        height: isOpen ? "auto" : 0,
        opacity: isOpen ? 1 : 0,
      }}
      transition={transition}
      className={`overflow-hidden ${className}`}
    >
      {children}
    </motion.div>
  );
}
