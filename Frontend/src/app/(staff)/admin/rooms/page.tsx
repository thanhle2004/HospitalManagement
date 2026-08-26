"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useRooms, useUpdateRoomStatus } from "@/features/rooms/hooks";
import { RoomFormDialog } from "@/features/rooms/components/room-form-dialog";
import type { Room, RoomStatus } from "@/features/rooms/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS: RoomStatus[] = ["ACTIVE", "INACTIVE", "MAINTENANCE"];

const STATUS_BADGE: Record<RoomStatus, "success" | "default" | "warning"> = {
  ACTIVE: "success",
  INACTIVE: "default",
  MAINTENANCE: "warning",
};

const STATUS_LABEL: Record<RoomStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
  MAINTENANCE: "Bảo trì",
};

export default function RoomsPage() {
  const rooms = useRooms();
  const updateStatus = useUpdateRoomStatus();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (room: Room) => {
    setEditing(room);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Phòng khám</h1>
          <p className="text-sm text-slate-500">Quản lý phòng khám vật lý</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo mới
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Số phòng</TableHead>
              <TableHead>Tên phòng</TableHead>
              <TableHead>Loại phòng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-40 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {rooms.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Chưa có phòng khám nào
                </TableCell>
              </TableRow>
            )}
            {rooms.data?.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="font-medium text-slate-900">{room.roomNumber}</TableCell>
                <TableCell>{room.name}</TableCell>
                <TableCell>{room.roomType.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[room.status]}>{STATUS_LABEL[room.status]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <select
                      className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                      value={room.status}
                      disabled={updateStatus.isPending}
                      onChange={(e) =>
                        updateStatus.mutate({ id: room.id, status: e.target.value as RoomStatus })
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(room)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RoomFormDialog open={formOpen} onOpenChange={setFormOpen} room={editing} />
    </div>
  );
}
