import type { MetricsSnapshot, SimulationRoomState } from "../types";
import { RoomCard, type RoomBoardEntry } from "./room-card";

export function HospitalBoard({
  rooms,
  perRoom,
  roomState,
}: {
  rooms: RoomBoardEntry[];
  perRoom: MetricsSnapshot["perRoom"];
  roomState?: SimulationRoomState[];
}) {
  if (rooms.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có phòng nào trong scenario này.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rooms.map((room) => (
        <RoomCard key={room.roomId} room={room} metrics={perRoom[room.roomId]} state={roomState?.find((state) => state.roomId === room.roomId)} />
      ))}
    </div>
  );
}