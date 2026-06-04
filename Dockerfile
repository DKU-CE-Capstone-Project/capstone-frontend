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
EXPOSE 80
