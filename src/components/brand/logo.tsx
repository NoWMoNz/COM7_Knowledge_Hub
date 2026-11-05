import Image from "next/image";

const RATIO = 314 / 162; // intrinsic size of public/brand/com7-logo.png

/** COM7 logo (transparent PNG). Use on light backgrounds; the grey wordmark needs a white/very light surface. */
export function Logo({ height = 32, className, priority = false }: { height?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/com7-logo.png"
      alt="COM7"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      unoptimized
      className={className}
    />
  );
}
