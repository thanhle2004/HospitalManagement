import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SimulationRunSnapshot } from './simulation-orchestrator.service';

/**
 * [Phase 6] Namespace /simulation — CHỈ đẩy snapshot cho run đang ở
 * clockPolicy PACED/STEP (ai đó đang thực sự XEM trực tiếp). Run headless
 * ASAP (Phase 4, đa số Scenario chạy để lấy số liệu) không đụng tới gateway
 * này — không có ai xem thì không có gì để đẩy, xem
 * docs/simulator-architecture.md §2.6 (lý do KHÔNG dùng lại pattern signal-
 * only của RealtimeGateway hiện có: full-table join lặp lại quá thường
 * xuyên ở tốc độ 10x-50x — gateway này đẩy PAYLOAD đầy đủ đã tính sẵn, để
 * client không phải tự gọi API lại mỗi lần nhận tín hiệu).
 *
 * Tần suất đẩy do CALLER (SimulationOrchestrator) tự kiểm soát — gateway
 * này không tự giới hạn, chỉ chuyển tiếp. Orchestrator throttle ở nguồn
 * (interval cố định, xem runHeadless()).
 */
@Injectable()
@WebSocketGateway({ namespace: '/simulation' })
export class SimulationGateway {
  private readonly logger = new Logger(SimulationGateway.name);

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { runId?: string }): void {
    if (!data?.runId) return;
    void client.join(this.room(data.runId));
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { runId?: string }): void {
    if (!data?.runId) return;
    void client.leave(this.room(data.runId));
  }

  emitSnapshot(runId: string, snapshot: SimulationRunSnapshot): void {
    if (!this.server) return; // chưa init (test/khởi động sớm) — bỏ qua thay vì crash
    try {
      this.server.to(this.room(runId)).emit('snapshot', { runId, ...snapshot });
    } catch (err) {
      // Đẩy socket thất bại KHÔNG được phép làm hỏng run đang chạy —
      // client tự có polling dự phòng qua GET /runs/:id (xem hooks.ts phía Frontend).
      this.logger.error(`Đẩy snapshot thất bại cho run #${runId}: ${err}`);
    }
  }

  emitFinished(runId: string, status: string): void {
    if (!this.server) return;
    try {
      this.server.to(this.room(runId)).emit('finished', { runId, status });
    } catch (err) {
      this.logger.error(`Đẩy sự kiện 'finished' thất bại cho run #${runId}: ${err}`);
    }
  }

  private room(runId: string): string {
    return `simulation:${runId}`;
  }
}