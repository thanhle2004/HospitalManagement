"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function PatientQrCode({ token }: { token: string }) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(token, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((value) => {
      if (active) setSource(value);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (!source) return <div className="size-52 animate-pulse rounded-2xl bg-slate-100" />;

  return (
    <Image
      src={source}
      alt="Mã QR check-in phòng khám"
      width={208}
      height={208}
      unoptimized
      className="rounded-2xl"
      priority
    />
  );
}
