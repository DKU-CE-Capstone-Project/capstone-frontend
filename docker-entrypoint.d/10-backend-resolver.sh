#!/bin/sh
# nginx:alpine 의 엔트리포인트는 nginx 를 띄우기 전에 /docker-entrypoint.d/*.sh 를
# 이름 순서대로 실행한다. 여기서 nginx.conf 가 참조하는 두 가지를 만들어 둔다.
#
#   1) resolver          — 컨테이너의 DNS 서버. proxy_pass 에 변수를 쓰면 nginx 가
#                          요청 시점에 DNS 를 조회하는데, 그때 쓸 resolver 가 필요하다.
#                          Docker 사용자 정의 네트워크는 127.0.0.11(내장 DNS)이고,
#                          기본 브리지나 k8s 는 다르므로 /etc/resolv.conf 에서 읽는다.
#   2) $econmind_backend — 백엔드 주소. BACKEND_ORIGIN 환경변수로 덮어쓸 수 있다.
#
# 생성 파일은 00- 접두사라 default.conf 보다 먼저 include 된다.
set -eu

BACKEND_ORIGIN="${BACKEND_ORIGIN:-econmind-api:8000}"

# "nameserver 1.2.3.4" 줄에서 주소만 뽑아 공백으로 이어 붙인다 (뒤에 공백 하나 남음).
RESOLVERS="$(awk '/^nameserver/ { printf "%s ", $2 }' /etc/resolv.conf 2>/dev/null || true)"
[ -n "$RESOLVERS" ] || RESOLVERS="127.0.0.11 "

cat > /etc/nginx/conf.d/00-backend.conf <<CONF
# 이 파일은 10-backend-resolver.sh 가 컨테이너 기동 시 생성한다. 직접 수정하지 말 것.
resolver ${RESOLVERS}valid=10s ipv6=off;
resolver_timeout 5s;

map \$host \$econmind_backend {
    default "${BACKEND_ORIGIN}";
}
CONF

echo "[10-backend-resolver] resolver=${RESOLVERS}| backend=${BACKEND_ORIGIN}"
