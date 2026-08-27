"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminQueueApi } from "./api";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";

const QUERY_KEY = ["admin-queue"] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useAdminQueueOverview() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminQueueApi.overview,
    refetchInterval: 5_000,
  });
}

export function useMoveQueueEntryToFront() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (queueEntryId: number) => adminQueueApi.moveToFront(queueEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã đưa bệnh nhân lên đầu hàng đợi");
    },
    onError: (error) => toast.error(errorMessage(error, "Không thể đổi thứ tự hàng đợi")),
  });
}

export function useMoveQueueEntryAfter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      queueEntryId,
      targetQueueEntryId,
    }: {
      queueEntryId: number;
      targetQueueEntryId: number;
    }) => adminQueueApi.moveAfter(queueEntryId, targetQueueEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã cập nhật thứ tự hàng đợi");
    },
    onError: (error) => toast.error(errorMessage(error, "Không thể đổi thứ tự hàng đợi")),
  });
}
