"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ActivityLogItem } from "../types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function metadataText(metadata: unknown | null) {
  if (metadata === null) return "Không có dữ liệu bổ sung";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

export function ActivityLogDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: ActivityLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto"
        title="Chi tiết nhật ký hoạt động"
        description="Bản ghi audit chỉ đọc và không thể chỉnh sửa từ giao diện quản trị."
      >
        {log && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{log.action}</Badge>
              <span className="text-sm text-slate-500">{formatDateTime(log.createdAt)}</span>
            </div>

            <dl className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Đối tượng</dt>
                <dd className="mt-1 text-sm text-slate-900">{log.entity}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Mã đối tượng</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-900">{log.entityId}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Người thực hiện</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-900">
                  {log.userId ?? "Hệ thống"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Địa chỉ IP</dt>
                <dd className="mt-1 text-sm text-slate-900">{log.ipAddress ?? "Không ghi nhận"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Thiết bị / trình duyệt</dt>
                <dd className="mt-1 break-words text-xs text-slate-700">
                  {log.userAgent ?? "Không ghi nhận"}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">Dữ liệu bổ sung</h3>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {metadataText(log.metadata)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
