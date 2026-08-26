import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@prisma/client';
import { VisitsRepository } from '../visits/repositories/visits.repository';
import { DoctorAssignmentsRepository } from '../doctor-assignments/repositories/doctor-assignments.repository';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PatientJwtPayload } from '../patient-auth/interfaces/patient-jwt-payload.interface';
import { VISIT_UPDATED_EVENT, VisitUpdatedEvent } from '../visits/events/visit-updated.event';
import {
  ROOM_QUEUE_UPDATED_EVENT,
  RoomQueueUpdatedEvent,
} from '../check-in/events/room-queue-updated.event';

const ADMIN_ROOM = 'admin-dashboard';
const patientRoom = (patientId: string) => `patient:${patientId}`;
const doctorRoomChannel = (roomId: number) => `room:${roomId}`;

/**
 * Gateway KHÔNG dùng chung JwtAuthGuard/PatientJwtAuthGuard của HTTP (2 guard
 * đó chỉ hoạt động trên ExecutionContext kiểu HTTP). WebSocket tự xác thực
 * thủ công ở handleConnection — thử lần lượt secret Staff rồi Patient, y hệt
 * cách phân biệt "loại token nào" mà không cần Passport.
 *
 * Pattern hoạt động: mọi service hiện có (VisitsService, RoutingEngineService,
 * CheckInService, DoctorService) chỉ emit "đã đổi" qua EventEmitter2 — KHÔNG
 * gửi kèm dữ liệu đầy đủ qua socket. Client nhận tín hiệu rồi tự gọi lại
 * REST API tương ứng để lấy state mới nhất — tránh phải duy trì 2 nguồn sự
 * thật (REST response shape và WS payload shape) cho cùng 1 dữ liệu.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly visitsRepository: VisitsRepository,
    private readonly doctorAssignmentsRepository: DoctorAssignmentsRepository,
  ) {}

  /**
   * Client kết nối kèm token qua `io(url, { auth: { token } })`. Thử xác
   * thực lần lượt Staff -> Patient; token Device không cần WS nên bỏ qua.
   * Xác định phòng (Socket.IO room) join tại thời điểm connect — nếu ca
   * trực của Doctor đổi giữa chừng, phải reconnect lại để cập nhật (giới
   * hạn chấp nhận được cho quy mô đồ án).
   */
  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      this.rejectConnection(client, 'Thiếu token xác thực');
      return;
    }

    const staffPayload = await this.tryVerify<JwtPayload>(
      token,
      'jwt.accessSecret',
    );
    if (staffPayload) {
      await this.joinAsStaff(client, staffPayload);
      return;
    }

    const patientPayload = await this.tryVerify<PatientJwtPayload>(
      token,
      'jwt.patientAccessSecret',
    );
    if (patientPayload) {
      await client.join(patientRoom(patientPayload.sub));
      this.logger.log(`Patient ${patientPayload.sub} kết nối WebSocket`);
      return;
    }

    this.rejectConnection(client, 'Token không hợp lệ hoặc đã hết hạn');
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client ngắt kết nối: ${client.id}`);
  }

  /** Client tự gọi lại nếu ca trực Doctor đổi mà không muốn reconnect toàn bộ socket */
  @SubscribeMessage('doctor.refresh-rooms')
  async handleRefreshDoctorRooms(client: Socket): Promise<void> {
    const payload = client.data?.staffPayload as JwtPayload | undefined;
    if (!payload || payload.role !== UserRole.DOCTOR) return;

    for (const room of client.rooms) {
      if (room.startsWith('room:')) client.leave(room);
    }
    const roomIds = await this.doctorAssignmentsRepository.findActiveRoomIdsForDoctor(
      payload.sub,
    );
    for (const roomId of roomIds) {
      await client.join(doctorRoomChannel(roomId));
    }
  }

  @OnEvent(VISIT_UPDATED_EVENT)
  async handleVisitUpdated(event: VisitUpdatedEvent): Promise<void> {
    const visit = await this.visitsRepository.findById(event.visitId);
    if (!visit) return;
    this.server
      .to(patientRoom(visit.patientId))
      .emit('visit.updated', { visitId: event.visitId });
  }

  @OnEvent(ROOM_QUEUE_UPDATED_EVENT)
  handleRoomQueueUpdated(event: RoomQueueUpdatedEvent): void {
    this.server
      .to(doctorRoomChannel(event.roomId))
      .to(ADMIN_ROOM)
      .emit('room-queue.updated', { roomId: event.roomId });
  }

  private async joinAsStaff(client: Socket, payload: JwtPayload): Promise<void> {
    client.data.staffPayload = payload;

    if (payload.role === UserRole.ADMIN) {
      await client.join(ADMIN_ROOM);
      this.logger.log(`Admin ${payload.email} kết nối WebSocket`);
      return;
    }

    if (payload.role === UserRole.DOCTOR) {
      const roomIds = await this.doctorAssignmentsRepository.findActiveRoomIdsForDoctor(
        payload.sub,
      );
      for (const roomId of roomIds) {
        await client.join(doctorRoomChannel(roomId));
      }
      this.logger.log(
        `Doctor ${payload.email} kết nối WebSocket (${roomIds.length} phòng đang trực)`,
      );
    }
  }

  private async tryVerify<T extends object>(
    token: string,
    secretConfigKey: string,
  ): Promise<T | null> {
    try {
      return await this.jwtService.verifyAsync<T>(token, {
        secret: this.configService.get<string>(secretConfigKey),
      });
    } catch {
      return null;
    }
  }

  private rejectConnection(client: Socket, reason: string): void {
    this.logger.warn(`Từ chối kết nối WebSocket: ${reason}`);
    client.emit('error', { message: reason });
    client.disconnect(true);
  }
}
