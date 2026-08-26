# ── Stage 1: build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# npm ci (không --omit=dev) vì cần cả devDependencies để build (TypeScript,
# @nestjs/cli...) VÀ để stage production bên dưới copy nguyên node_modules
# này sang dùng luôn — tránh phải cài lại lần 2.
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 2: production ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy nguyên node_modules đã build ở stage 1 (bao gồm cả `prisma` CLI —
# cần thiết để chạy `prisma migrate deploy` lúc container khởi động; nếu
# dùng --omit=dev ở đây thì thiếu prisma CLI, chỉ còn @prisma/client).
# Đánh đổi: image nặng hơn 1 bản "chỉ production deps" thuần tuý, nhưng
# đơn giản và chắc chắn chạy được — hợp lý cho quy mô đồ án.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 3000

# Chạy migration (idempotent — bỏ qua migration đã áp dụng) trước khi start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
