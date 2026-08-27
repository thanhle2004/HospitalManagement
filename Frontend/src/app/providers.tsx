"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    // Dọn token do phiên bản cũ từng persist vào localStorage. Slice 1 chỉ dùng
    // cookie HttpOnly do Route Handler phía server quản lý.
    window.localStorage.removeItem("staff-auth");
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
