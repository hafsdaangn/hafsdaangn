import Image from "next/image";

export function Brand({ full = false }: { full?: boolean }) {
  return (
    <span className={`brand${full ? " brand-full" : ""}`}>
      <Image
        src={`/brand/${full ? "logo" : "symbol"}.svg`}
        alt="합스당근"
        width={full ? 1042 : 562}
        height={607}
        priority
        className="brand-logo"
      />
    </span>
  );
}
