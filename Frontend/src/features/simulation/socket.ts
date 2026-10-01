/**
 * [Phase 6] Client cho namespace /simulation (xem Backend/.../simulation.gateway.ts).
 *
 * CHƯA được hooks.ts sử dụng mặc định — lý do: RealtimeGateway (gateway
 * thật đã có sẵn trong Backend, không phải do phase này tạo ra) yêu cầu
 * `io(url, { auth: { token } })` với 1 access token JWT thô. Token đó hiện
 * được lưu trong cookie HttpOnly do Next.js server quản lý (xem comment đầu
 * file src/lib/api-client.ts) — KHÔNG có route nào trong codebase này trả
 * token thô đó về cho client JS đọc được (đã kiểm tra `/api/session` — chỉ
 * trả thông tin phiên, không trả token). Đây là một phần hạ tầng dùng
 * chung (ảnh hưởng RealtimeGateway hiện có nữa, không riêng gì simulation)
 * còn thiếu, không phải lỗi của module này.
 *
 * Cho tới khi có cách lấy token phía client (vd 1 route
 * /api/session/ws-token trả token ngắn hạn riêng cho WebSocket), giao diện
 * Simulator dùng POLLING qua GET /runs/:id làm nguồn cập nhật DUY NHẤT
 * (xem hooks.ts — refetchInterval rút ngắn khi run đang RUNNING/PAUSED).
 * File này viết sẵn, đúng shape server đã hỗ trợ — gọi connectSimulationSocket()
 * kèm token khi hạ tầng đó sẵn sàng, không cần sửa gì ở Backend.
 */
"use client";

import { io, type Socket } from "socket.io-client";
import type { SimulationSocketFinished, SimulationSocketSnapshot } from "./types";

export interface SimulationSocketHandlers {
  onSnapshot?: (snapshot: SimulationSocketSnapshot) => void;
  onFinished?: (payload: SimulationSocketFinished) => void;
  onConnectError?: (error: Error) => void;
}

export function connectSimulationSocket(
  runId: string,
  token: string,
  handlers: SimulationSocketHandlers,
): Socket {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
  const socket = io(`${wsUrl}/simulation`, {
    auth: { token },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    socket.emit("join", { runId });
  });
  socket.on("snapshot", (payload: SimulationSocketSnapshot) => {
    if (payload.runId === runId) handlers.onSnapshot?.(payload);
  });
  socket.on("finished", (payload: SimulationSocketFinished) => {
    if (payload.runId === runId) handlers.onFinished?.(payload);
  });
  socket.on("connect_error", (error: Error) => handlers.onConnectError?.(error));

  return socket;
}

export function disconnectSimulationSocket(socket: Socket, runId: string): void {
  socket.emit("leave", { runId });
  socket.disconnect();
}