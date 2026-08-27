import * as Joi from 'joi';

const corsOrigins = Joi.string().custom((value: string, helpers) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes('*')) {
    return helpers.error('any.invalid');
  }

  try {
    for (const origin of origins) {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
        return helpers.error('any.invalid');
      }
    }
  } catch {
    return helpers.error('any.invalid');
  }

  return value;
}, 'CORS origin allowlist');

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: corsOrigins.required(),
    otherwise: corsOrigins.default('http://localhost:3001'),
  }),
  SWAGGER_ENABLED: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().truthy('true').falsy('false').default(false),
    otherwise: Joi.boolean().truthy('true').falsy('false').default(true),
  }),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['mysql'] })
    .required()
    .messages({
      'string.uriCustomScheme':
        'DATABASE_URL phải có dạng mysql://USER:PASSWORD@HOST:PORT/DATABASE',
      'any.required': 'DATABASE_URL là bắt buộc — kiểm tra file .env',
    }),
  JWT_ACCESS_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_ACCESS_SECRET phải dài ít nhất 16 ký tự',
    'any.required': 'JWT_ACCESS_SECRET là bắt buộc — kiểm tra file .env',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_REFRESH_SECRET phải dài ít nhất 16 ký tự',
    'any.required': 'JWT_REFRESH_SECRET là bắt buộc — kiểm tra file .env',
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Token của Patient dùng secret RIÊNG với Staff — token 2 bên không thể
  // dùng lẫn cho nhau dù cùng thuật toán JWT.
  JWT_PATIENT_ACCESS_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_PATIENT_ACCESS_SECRET phải dài ít nhất 16 ký tự',
    'any.required': 'JWT_PATIENT_ACCESS_SECRET là bắt buộc — kiểm tra file .env',
  }),
  JWT_PATIENT_ACCESS_EXPIRES_IN: Joi.string().default('30m'),
  JWT_PATIENT_REFRESH_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_PATIENT_REFRESH_SECRET phải dài ít nhất 16 ký tự',
    'any.required': 'JWT_PATIENT_REFRESH_SECRET là bắt buộc — kiểm tra file .env',
  }),
  JWT_PATIENT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Token của Device dùng secret RIÊNG với Staff/Patient — device chỉ cần
  // 1 access token (không có refresh) vì có thể re-login bằng code+secret bất kỳ lúc nào.
  JWT_DEVICE_ACCESS_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_DEVICE_ACCESS_SECRET phải dài ít nhất 16 ký tự',
    'any.required': 'JWT_DEVICE_ACCESS_SECRET là bắt buộc — kiểm tra file .env',
  }),
  JWT_DEVICE_ACCESS_EXPIRES_IN: Joi.string().default('12h'),

  // Cấu hình OTP
  OTP_LENGTH: Joi.number().default(6),
  OTP_EXPIRES_IN_SECONDS: Joi.number().default(300), // 5 phút
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().default(60),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
  AUTH_RATE_LIMIT_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),
});
