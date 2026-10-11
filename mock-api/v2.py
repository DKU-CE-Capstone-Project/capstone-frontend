"""Local browser UI fixture for docs/10; synthetic news/report, no DB or external API.
Run: python3 scripts/serve-v2-fixtures.py --port 9036 (PAID prototype by default)
Use query 검증0, 검증부분, 검증실패, 검증전략실패 for explicit edge cases.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import RLock
import time
import uuid
from datetime import datetime, timedelta, timezone

spec = importlib.util.spec_from_file_location('fixture_news', Path(__file__).resolve().parent / 'server.py')
news_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(news_source)
NEWS = news_source.NEWS
BY_ID = news_source.NEWS_BY_ID
LOCK = RLock()
SESSIONS = {}
MAPS = {}
JOBS = {}
REPORTS = {}
STRATEGIES = {}
KEYS = {}
SEQ = 0
TIER = os.environ.get('PROTOTYPE_TIER', 'PAID')

def uid(): return str(uuid.uuid4())
def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
def expiry(): return (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat().replace('+00:00', 'Z')
def selection(target, count, partial=False): return dict(status='partial' if partial else 'complete' if count >= target else 'insufficient', reason='fixture_dependency_failure' if partial else None if count >= target else 'no_eligible_related', requested=target, returned=count, shortage=count < target, budget_exhausted=False)
def card(item):
    result = news_source.news_card(item)
    for key in ['summary','related_stock_names']: result.pop(key, None)
    result['source_name'] = '[로컬 fixture] ' + result['source_name']
    result['thumbnail_url'] = None
    return result

def node(item, parent=None, level=0):
    global SEQ
    SEQ += 1
    return dict(node_id=f'fixture-node-{SEQ}', news_id=item['news_id'], parent_node_id=parent, level=level, expanded=level == 0, batch=0, news=card(item))

def detach(m):
    if m['active_report_job_id'] in JOBS:
        j = JOBS[m['active_report_job_id']]
        if j['status'] in ['queued','running']: j['status'] = 'cancel_requested'
    m['active_report_job_id'] = None
    m['last_result'] = None

def create_map(query):
    empty = query == '검증0'
    pool = [] if empty else news_source.search(query, 20)
    nodes = []
    if pool:
        nodes = [node(pool[0])]
        nodes += [node(n, nodes[0]['node_id'], 1) for n in pool[1:5]]
    s = selection(4, max(0, len(nodes)-1), query == '검증부분')
    return dict(map_id=uid(), revision=1, query=query, state='empty' if empty else 'active', root_node_id=nodes[0]['node_id'] if nodes else None, nodes=nodes, branches=[dict(parent_node_id=nodes[0]['node_id'], child_node_ids=[n['node_id'] for n in nodes[1:]], display_selection=s, last_attempt=s)] if nodes else [], initial_selection=s, selected_news_ids=[], detail_news_id=None, report_panel_open=False, active_report_job_id=None, last_result=None, expires_at=expiry())

class FixtureError(Exception):
    def __init__(self, status, code, message): self.status, self.code, self.message = status, code, message

def fail(status, code, message): raise FixtureError(status, code, message)

def get_map(sid, map_id):
    m = MAPS.get((sid, map_id))
    if m is None: fail(404,'RESOURCE_NOT_FOUND','탐색을 찾을 수 없습니다.')
    return m

def check_revision(m, body):
    if body.get('expected_revision') != m['revision']: fail(409,'MAP_REVISION_CONFLICT','탐색이 변경됐습니다. 최신 상태를 확인하세요.')

def finish_job(sid, j, m):
    if m['query'] == '검증실패':
        j['progress'].update(processed=len(j['request_news_ids']),succeeded=0,failed=len(j['request_news_ids']))
        j.update(status='failed',stage='done',error=dict(code='NO_USABLE_EVIDENCE',message='[로컬 fixture] 모든 본문 추출 실패',retryable=True,details={}))
        return
    selected = [BY_ID[i] for i in j['request_news_ids']]
    failed = selected[-1:] if m['query'] == '검증부분' and len(selected) > 1 else []
    used = [n for n in selected if n not in failed]
    j['progress'].update(processed=len(selected),succeeded=len(used),failed=len(failed))
    rid, stid = uid(), uid()
    report = dict(schema_version=2,report_id=rid,title='[로컬 fixture] 선택 기사 영향 리포트',event_summary=used[0]['summary'],event_analysis='[합성 UI fixture] '+used[0]['body'],market_impact='실제 모델·시장 분석을 호출하지 않은 로컬 UI fixture입니다.',stock_impacts=[dict(ticker=None,name=name,impact='[합성 UI fixture] 시장 영향 표시 확인',direction='unknown',evidence_news_ids=[used[0]['news_id']]) for name in used[0]['stocks']],risk_factors=['UI fixture는 투자 분석이 아닙니다.'],requested_news_ids=j['request_news_ids'],used_evidence=[dict(news_id=n['news_id'],title=n['title'],source_name=n['source_name'],source_url=news_source._source_url(n),published_at=news_source._at(n['offset']),body_id=uid(),content_hash=hashlib.sha256(n['body'].encode()).hexdigest(),input_char_count=len(n['body']),truncated=False) for n in used],failed_evidence=[dict(news_id=n['news_id'],code='EXTRACTION_TIMEOUT',message='[합성 fixture] 본문 추출 시간 초과',retryable=True) for n in failed],coverage=dict(requested_count=len(selected),used_count=len(used),failed_count=len(failed)),rag_evidence=[],verification=dict(status='unavailable',notes=['[합성 fixture] 실제 critic 검증 없음']),created_at=now())
    REPORTS[(sid,rid)] = report
    strategy = dict(schema_version=2,strategy_id=stid,report_id=rid,risk_level='medium',period='short',strategy_summary='[합성 UI fixture] 실제 전략 생성 없음',risk_warning='실제 투자 권유가 아닙니다.',strategy_items=[dict(ticker=None,stock_name=name,action='watch',reason='[합성 fixture] 관심 종목 표시') for name in used[0]['stocks']],created_at=now())
    warnings = ['PARTIAL_EVIDENCE'] if failed else []
    if m['query'] == '검증전략실패': stid = None; warnings.append('STRATEGY_GENERATION_FAILED')
    else: STRATEGIES[(sid,stid)] = strategy
    j.update(status='completed',stage='done',result=dict(report_id=rid,strategy_id=stid,report_reused=False,strategy_reused=False),warnings=warnings)
    if m['active_report_job_id'] == j['job_id']:
        m['last_result'] = dict(report_id=rid,strategy_id=stid)
        m['active_report_job_id'] = None
        m['revision'] += 1

class Handler(BaseHTTPRequestHandler):
    def send(self, status, data=None):
        payload = b'' if status == 204 else json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status)
        origin = self.headers.get('Origin')
        if origin and origin.startswith(('http://localhost:','http://127.0.0.1:')):
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Access-Control-Allow-Credentials','true')
            self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Headers','Content-Type, Idempotency-Key')
        self.send_header('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS')
        if getattr(self,'set_cookie',None): self.send_header('Set-Cookie',self.set_cookie)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    def do_OPTIONS(self): self.send(204)
    def route(self):
        if self.path == '/health': self.send(200,dict(status='local-v2-ui-fixture')); return
        try:
            with LOCK:
                cookies = SimpleCookie(self.headers.get('Cookie',''))
                sid = cookies['econmind_sid'].value if 'econmind_sid' in cookies else None
                resumed = sid in SESSIONS
                if not resumed:
                    sid = uid(); SESSIONS[sid] = dict(session_epoch=uid(),resumed=False,expires_at=expiry(),prototype_tier=TIER,capabilities=dict(max_report_articles=10 if TIER == 'PAID' else 1,initial_related_target=4,branch_related_target=3,max_map_nodes=40,max_map_depth=4))
                    self.set_cookie = f'econmind_sid={sid}; HttpOnly; Path=/; SameSite=Lax'
                session = SESSIONS[sid]
                parts = self.path.split('?')[0].split('/')[3:]
                length = int(self.headers.get('Content-Length','0'))
                body = json.loads(self.rfile.read(length)) if length else {}
                status, result = self.dispatch(sid,session,resumed,parts,body)
                self.send(status,result)
        except FixtureError as exc:
            self.send(exc.status,dict(error=dict(code=exc.code,message=exc.message,retryable=exc.status >= 500,details={}),request_id=uid()))
        except (ValueError,KeyError): self.send(422,dict(error=dict(code='INVALID_REQUEST',message='fixture 입력 오류',retryable=False,details={}),request_id=uid()))
    def dispatch(self,sid,s,resumed,p,b):
        if self.path == '/health': return 200,dict(status='local-v2-ui-fixture')
        kind = p[0] if p else ''
        if kind == 'session':
            if self.command == 'DELETE':
                for (owner,_),m in list(MAPS.items()):
                    if owner == sid: detach(m); MAPS.pop((owner,m['map_id']))
                SESSIONS.pop(sid,None); self.set_cookie = 'econmind_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
                return 204,None
            return 200,{**s,'resumed':resumed}
        if kind == 'maps':
            if len(p) == 1:
                query = b['query'].strip()
                if not 1 <= len(query) <= 100: fail(422,'INVALID_REQUEST','검색어는 1~100자입니다.')
                m = create_map(query); MAPS[(sid,m['map_id'])] = m
                return 201,m
            m = get_map(sid,p[1])
            if self.command == 'GET': return 200,m
            if self.command == 'DELETE': detach(m); MAPS.pop((sid,p[1])); return 204,None
            check_revision(m,b)
            if self.command == 'PATCH':
                if 'selected_news_ids' in b:
                    ids=b['selected_news_ids']
                    if len(ids) > s['capabilities']['max_report_articles']: fail(403,'PLAN_ARTICLE_LIMIT_EXCEEDED','리포트 선택 한도를 초과했습니다.')
                    if set(ids)-{n['news_id'] for n in m['nodes']}: fail(422,'INVALID_REQUEST','보이는 기사만 선택하세요.')
                    if ids != m['selected_news_ids']: detach(m)
                    m['selected_news_ids']=ids
                    if not ids: m['report_panel_open']=False
                for field in ['detail_news_id','report_panel_open']:
                    if field in b: m[field]=b[field]
            elif p[2] == 'reset':
                detach(m); fresh=create_map(m['query']); fresh.update(map_id=m['map_id'],revision=m['revision']); m.update(fresh)
            elif p[2] == 'branches':
                parent=next(n for n in m['nodes'] if n['node_id']==b['parent_node_id'])
                target=4 if parent['level']==0 else 3
                if parent['level']>=4: fail(422,'MAP_DEPTH_LIMIT_REACHED','최대 탐색 깊이입니다.')
                shown={n['news_id'] for n in m['nodes']}
                history=parent.setdefault('_fixture_history',[])
                candidates=[n for n in NEWS if n['news_id'] not in shown and n['news_id'] not in history][:target]
                attempt=selection(target,len(candidates))
                oldbranch=next((br for br in m['branches'] if br['parent_node_id']==parent['node_id']),None)
                if candidates:
                    removed=set()
                    def descend(pid):
                        for n in m['nodes']:
                            if n['parent_node_id']==pid: removed.add(n['node_id']); descend(n['node_id'])
                    descend(parent['node_id']); lost={n['news_id'] for n in m['nodes'] if n['node_id'] in removed}
                    if lost & set(m['selected_news_ids']): detach(m)
                    m['selected_news_ids']=[i for i in m['selected_news_ids'] if i not in lost]
                    if m['detail_news_id'] in lost: m['detail_news_id']=None
                    m['nodes']=[n for n in m['nodes'] if n['node_id'] not in removed]
                    m['branches']=[br for br in m['branches'] if br['parent_node_id'] not in removed and br['parent_node_id']!=parent['node_id']]
                    children=[node(n,parent['node_id'],parent['level']+1) for n in candidates]
                    m['nodes']+=children; history.extend(n['news_id'] for n in children)
                    m['branches'].append(dict(parent_node_id=parent['node_id'],child_node_ids=[n['node_id'] for n in children],display_selection=attempt,last_attempt=attempt))
                elif oldbranch: oldbranch['last_attempt']=attempt
                parent['expanded']=True; parent['batch']+=1
            m['revision']+=1
            return 200,m
        if kind == 'report-jobs':
            if len(p)==1:
                key=self.headers.get('Idempotency-Key')
                if not key: fail(422,'INVALID_REQUEST','Idempotency-Key가 필요합니다.')
                raw=json.dumps(b,sort_keys=True)
                previous=KEYS.get((sid,key))
                if previous:
                    if previous[0]!=raw: fail(409,'IDEMPOTENCY_CONFLICT','같은 키에 다른 입력입니다.')
                    return 202,JOBS[previous[1]]
                m=get_map(sid,b['map_id']); check_revision(m,b)
                ids=b['news_ids']
                if len(ids)>s['capabilities']['max_report_articles']: fail(403,'PLAN_ARTICLE_LIMIT_EXCEEDED','리포트 선택 한도를 초과했습니다.')
                if not ids or len(set(ids))!=len(ids): fail(422,'INVALID_REQUEST','고유 기사 1건 이상이 필요합니다.')
                detach(m); jid=uid(); m['revision']+=1
                j=dict(job_id=jid,client_request_id=b['client_request_id'],map_id=m['map_id'],accepted_map_revision=m['revision'],status='queued',stage='queued',request_news_ids=ids,progress=dict(requested=len(ids),processed=0,succeeded=0,failed=0),result=None,warnings=[],error=None,created_at=now(),updated_at=now(),expires_at=expiry())
                JOBS[jid]=j; KEYS[(sid,key)]=(raw,jid); m.update(selected_news_ids=ids,report_panel_open=True,detail_news_id=None,active_report_job_id=jid)
                return 202,j
            j=JOBS.get(p[1]);
            if not j or (sid,j['map_id']) not in MAPS: fail(404,'RESOURCE_NOT_FOUND','작업을 찾을 수 없습니다.')
            if len(p)>2 or j['status']=='cancel_requested': j.update(status='cancelled',stage='done'); return 200,j
            if j['status'] in ['queued','running']:
                stages=['queued','extracting','analyzing','verifying','strategy','saving','done']; j['stage']=stages[stages.index(j['stage'])+1]; j['status']='running'
                if stages.index(j['stage'])>=2: j['progress'].update(processed=len(j['request_news_ids']),succeeded=len(j['request_news_ids']))
                if j['stage']=='done': finish_job(sid,j,get_map(sid,j['map_id']))
            return 200,j
        if kind in ['reports','strategies']:
            result=(REPORTS if kind=='reports' else STRATEGIES).get((sid,p[1]))
            if result is None: fail(404,'RESOURCE_NOT_FOUND','결과를 찾을 수 없습니다.')
            return 200,result
        fail(404,'RESOURCE_NOT_FOUND','fixture 경로가 없습니다.')
    do_GET=route
    do_POST=route
    do_PATCH=route
    do_DELETE=route
    def log_message(self,fmt,*args): pass

def main(default_port=8000):
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=default_port);args=parser.parse_args()
    host=os.environ.get('MOCK_API_HOST') or '127.0.0.1'
    print(f'Local v2 synthetic UI fixture: http://{host}:{args.port} ({TIER})',flush=True)
    ThreadingHTTPServer((host,args.port),Handler).serve_forever()

if __name__ == '__main__': main()
