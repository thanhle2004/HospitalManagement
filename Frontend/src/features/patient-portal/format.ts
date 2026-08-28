import type { VisitStatus, VisitStepStatus } from "./types";

export const visitStatusLabel: Record<VisitStatus, string> = {
  CREATED: "Đã tạo",
  WAITING: "Đang chờ",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
};

export const visitStepStatusLabel: Record<VisitStepStatus, string> = {
  LOCKED: "Chưa mở",
  READY: "Đang điều phối",
  ASSIGNED: "Đã có phòng",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn tất",
  SKIPPED: "Đã bỏ qua",
  CANCELLED: "Đã huỷ",
};

export function shortVisitId(id: string): string {
  return id.split("-")[0]?.toUpperCase() ?? id;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}
