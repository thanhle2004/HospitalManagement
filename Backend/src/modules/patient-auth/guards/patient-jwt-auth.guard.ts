import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard riêng cho các route dành cho Patient. KHÔNG đăng ký global (khác với
 * JwtAuthGuard của Staff) — vì phần lớn app là route Staff. Route nào dành
 * cho Patient thì gắn thủ công @UseGuards(PatientJwtAuthGuard). Route này
 * cũng phải @Public() để JwtAuthGuard (Staff, global) không chặn trước.
 */
@Injectable()
export class PatientJwtAuthGuard extends AuthGuard('patient-jwt') {}
