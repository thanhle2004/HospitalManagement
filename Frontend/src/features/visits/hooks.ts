"use client";

import { useQuery } from "@tanstack/react-query";
import { visitsApi } from "./api";

export function useAllVisits() {
  return useQuery({ queryKey: ["visits"], queryFn: visitsApi.listAll });
}
