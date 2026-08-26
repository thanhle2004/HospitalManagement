import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
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
});
