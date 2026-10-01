const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

const ROUTING_STRATEGY_NAMES = [
  'MIN_ESTIMATED_WAITING_TIME',
  'SHORTEST_QUEUE',
  'ROUND_ROBIN',
  'RANDOM',
  'LEAST_UTILISED',
] as const;

/** [Phase 3] Không hợp lệ hoặc để trống -> mặc định MIN_ESTIMATED_WAITING_TIME
 * — giữ nguyên hành vi routing trước khi có khái niệm "strategy" (xem
 * docs/simulator-architecture.md §5.1). Không throw khi giá trị sai — 1
 * biến môi trường gõ nhầm không được phép làm sập routing của cả bệnh viện,
 * chỉ nên log cảnh báo và rơi về mặc định an toàn. */
const parseRoutingStrategy = (value: string | undefined): string => {
  const upper = (value ?? '').trim().toUpperCase();
  if ((ROUTING_STRATEGY_NAMES as readonly string[]).includes(upper)) return upper;
  if (value) {
    // eslint-disable-next-line no-console -- configuration.ts chạy trước khi Logger của Nest sẵn sàng
    console.warn(
      `[configuration] ROUTING_STRATEGY="${value}" không hợp lệ, dùng mặc định MIN_ESTIMATED_WAITING_TIME. Giá trị hợp lệ: ${ROUTING_STRATEGY_NAMES.join(', ')}`,
    );
  }
  return 'MIN_ESTIMATED_WAITING_TIME';
};

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    http: {
      corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
      swaggerEnabled: parseBoolean(
        process.env.SWAGGER_ENABLED,
        nodeEnv !== 'production',
      ),
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

      patientAccessSecret: process.env.JWT_PATIENT_ACCESS_SECRET,
      patientAccessExpiresIn:
        process.env.JWT_PATIENT_ACCESS_EXPIRES_IN || '30m',
      patientRefreshSecret: process.env.JWT_PATIENT_REFRESH_SECRET,
      patientRefreshExpiresIn:
        process.env.JWT_PATIENT_REFRESH_EXPIRES_IN || '30d',

      deviceAccessSecret: process.env.JWT_DEVICE_ACCESS_SECRET,
      deviceAccessExpiresIn:
        process.env.JWT_DEVICE_ACCESS_EXPIRES_IN || '12h',
    },
    otp: {
      length: parseInt(process.env.OTP_LENGTH || '6', 10),
      expiresInSeconds: parseInt(
        process.env.OTP_EXPIRES_IN_SECONDS || '300',
        10,
      ),
      resendCooldownSeconds: parseInt(
        process.env.OTP_RESEND_COOLDOWN_SECONDS || '60',
        10,
      ),
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    },
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    security: {
      authRateLimitEnabled: parseBoolean(
        process.env.AUTH_RATE_LIMIT_ENABLED,
        true,
      ),
    },
    routing: {
      qrExpiresInSeconds: parseInt(
        process.env.ROUTING_QR_EXPIRES_IN_SECONDS || '1800', // 30 phút
        10,
      ),
      maxRetryAttempts: parseInt(
        process.env.ROUTING_MAX_RETRY_ATTEMPTS || '5',
        10,
      ),
      // [Phase 3] xem docs/simulator-architecture.md §5.1 — mặc định giữ
      // nguyên hành vi Greedy ETA nhỏ nhất đã có từ trước.
      strategy: parseRoutingStrategy(process.env.ROUTING_STRATEGY),
    },
    simulation: {
      // Default-off: current simulator deliberately exercises real domain
      // services/physical Room rows and must use a dedicated database.
      enabled: parseBoolean(process.env.SIMULATION_ENABLED, false),
    },
  };
};
