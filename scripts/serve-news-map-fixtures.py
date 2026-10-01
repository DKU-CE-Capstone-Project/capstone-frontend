"""Local UI-only fixtures for news-map states. No outbound requests.

Run this server on 127.0.0.1:9031, then start Vite with that VITE_API_BASE.
Select '검증0', '검증1', '검증2', '검증오류', '검증묶음', '검증확장' or '검증부분'.
These are fictional news. '검증확장' answers expand=true after 2 seconds;
'검증부분' fails that expansion request so the first valid result stays partial.
"""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


def card(nid, title, source="로컬 검증 매체"):
    return {"news_id": nid, "title": title, "summary": "", "description": "화면 검증을 위해 작성한 기사 설명입니다.",
            "source_name": source, "source_url": f"https://example.invalid/{nid}",
            "published_at": "2026-10-01T09:00:00Z", "thumbnail_url": "http://127.0.0.1:9031/image.svg",
            "keywords": ["검증 키워드"], "categories": ["반도체"], "related_stock_names": []}


def node(nid, title, story=()):
    return {**card(nid, title), "distance": 1, "relevance_score": None,
            "same_story": [card(f"{nid}-copy-{i}", f"{title} (다른 매체 {i})", f"다른 매체 {i}") for i in story],
            "same_story_total": len(story)}


def selection(status, returned, reason=None):
    return {"status": status, "reason": reason, "requested": 3, "returned": returned}


def related(case, expand):
    if case in "012":
        count = int(case)
        return {"related_news": [node(f"extra-{i}", f"검색 캐시에 없던 연관 기사 {i}") for i in range(count)],
                "selection": selection("insufficient" if count < 3 else "complete", count)}
    if case == "group":
        return {"related_news": [node("angle", "후속 분석 기사", story=(1, 2)), node("impact", "영향 분석 기사"),
                                 node("compare", "비교 기사")],
                "center_same_story": [card(f"center-copy-{i}", f"중심과 같은 소식 {i}", f"다른 매체 {i}") for i in (1, 2, 3)],
                "center_same_story_total": 3, "selection": selection("complete", 3)}
    first = {"related_news": [node("first", "최초 후보의 연관 기사")],
             "center_same_story": [card("center-copy-1", "중심과 같은 소식 1", "다른 매체 1")],
             "center_same_story_total": 1, "selection": selection("expandable", 1)}
    if not expand:
        return first
    time.sleep(2)
    if case == "partial":
        return None
    return {**first, "related_news": [*first["related_news"], node("more-1", "추가 검색으로 찾은 기사 1"),
                                      node("more-2", "추가 검색으로 찾은 기사 2")],
            "selection": selection("complete", 3)}


CASES = {"오류": "error", "묶음": "group", "확장": "expand", "부분": "partial"}


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
            names = ("0", "1", "2", "오류", "묶음", "확장", "부분")
            return self.send(200, {"keywords": [{"keyword": f"검증{name}", "category": "반도체", "rank": n}
                                               for n, name in enumerate(names, 1)]})
        if parsed.path.endswith("/news/search"):
            q = parse_qs(parsed.query).get("q", ["검증0"])[0]
            case = next((value for key, value in CASES.items() if key in q), q[-1] if q[-1:] in "012" else "0")
            return self.send(200, {"news_cards": [card(f"center-{case}", f"{q} 중심 기사")], "total_count": 1})
        if parsed.path.endswith("/related"):
            case = parsed.path.split("/")[-2].removeprefix("center-")
            if case == "error":
                return self.send(503, {"detail": "검증용 추가 검색 실패"})
            expand = parse_qs(parsed.query).get("expand", ["true"])[0] == "true"
            data = related(case, expand)
            if data is None:
                return self.send(503, {"detail": "검증용 확장 요청 실패"})
            return self.send(200, data)
        return self.send(404, {"detail": "Unknown fixture route"})


if __name__ == "__main__":
    print("News-map UI fixtures: http://127.0.0.1:9031 (no backend/external APIs)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 9031), Handler).serve_forever()
