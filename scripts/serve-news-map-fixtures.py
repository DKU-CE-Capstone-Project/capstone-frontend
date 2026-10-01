"""Local UI-only fixtures for 0/1/2 neighbours and failure. No outbound requests.

Run this server on 127.0.0.1:9031, then start Vite with that VITE_API_BASE.
Select '검증0', '검증1', '검증2' or '검증오류'. These are fictional news.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


def card(nid, title):
    return {"news_id": nid, "title": title, "summary": "", "description": "화면 검증을 위해 작성한 기사 설명입니다.",
            "source_name": "로컬 검증 매체", "source_url": "https://example.invalid/fictional",
            "published_at": "2026-10-01T09:00:00Z", "thumbnail_url": "http://127.0.0.1:9031/image.svg",
            "keywords": ["검증 키워드"], "categories": ["반도체"], "related_stock_names": [],
            "distance": 1, "relevance_score": None}


class Handler(BaseHTTPRequestHandler):
    def send(self, status, data, content_type="application/json"):
        payload = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5191")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/image.svg":
            return self.send(200, b'<svg xmlns="http://www.w3.org/2000/svg" width="520" height="520"><rect width="520" height="520" fill="#264970"/></svg>', "image/svg+xml")
        if parsed.path.endswith("/keywords/recommended"):
            return self.send(200, {"keywords": [{"keyword": f"검증{i}", "category": "반도체", "rank": n}
                                               for n, i in enumerate((0, 1, 2, "오류"), 1)]})
        if parsed.path.endswith("/news/search"):
            q = parse_qs(parsed.query).get("q", ["검증0"])[0]
            case = "error" if "오류" in q else q[-1] if q[-1:] in "012" else "0"
            return self.send(200, {"news_cards": [card(f"center-{case}", f"{q} 중심 기사")], "total_count": 1})
        if parsed.path.endswith("/related"):
            case = parsed.path.split("/")[-2].removeprefix("center-")
            if case == "error":
                return self.send(503, {"detail": "검증용 추가 검색 실패"})
            return self.send(200, {"related_news": [card(f"extra-{i}", f"검색 캐시에 없던 연관 기사 {i}") for i in range(int(case))]})
        return self.send(404, {"detail": "Unknown fixture route"})


if __name__ == "__main__":
    print("News-map UI fixtures: http://127.0.0.1:9031 (no backend/external APIs)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 9031), Handler).serve_forever()
