# 프론트엔드 UI 작업용 mock API. 표준 라이브러리만 쓰므로 pip install 이 없다.
FROM python:3.12-alpine
WORKDIR /app
COPY server.py .
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=3s \
    CMD wget -qO- http://127.0.0.1:8000/health || exit 1
CMD ["python", "-u", "server.py"]
