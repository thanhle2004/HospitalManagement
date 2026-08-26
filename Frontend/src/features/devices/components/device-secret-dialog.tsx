"use client";

import { useState } from "react";
import { Copy, Check, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeviceSecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceCode: string;
  secret: string;
}

export function DeviceSecretDialog({
  open,
  onOpenChange,
  deviceCode,
  secret,
}: DeviceSecretDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Secret cho thiết bị "${deviceCode}"`}>
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <TriangleAlert className="h-4 w-4 shrink-0 translate-y-0.5" />
            <p>
              Secret này chỉ hiển thị <strong>đúng 1 lần</strong>. Copy và nhập vào app Android
              ngay — nếu mất, phải cấp secret mới (secret cũ sẽ ngừng hoạt động).
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs break-all">
            <span className="flex-1">{secret}</span>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Đã copy" : "Copy"}
            </Button>
          </div>

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Đã lưu — Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
