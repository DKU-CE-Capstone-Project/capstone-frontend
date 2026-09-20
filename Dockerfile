# EconMind 프론트엔드 — Vite 빌드 → nginx 정적 서빙 + API 프록시
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_BASE="" → 프론트가 동일 출처(/analyze, /api/...)로 호출 → nginx가 백엔드로 프록시
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# resolver 와 $econmind_backend 를 기동 시 생성한다 (nginx.conf 주석 참고)
COPY docker-entrypoint.d/10-backend-resolver.sh /docker-entrypoint.d/10-backend-resolver.sh
RUN chmod +x /docker-entrypoint.d/10-backend-resolver.sh
# 백엔드를 다른 주소에 띄웠다면 이 값만 바꾸면 된다
ENV BACKEND_ORIGIN=econmind-api:8000
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
