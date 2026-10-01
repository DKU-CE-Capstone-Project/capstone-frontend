import { useEffect, useState } from 'react';
import type { NewsCard } from '../data/mockData';

export type SameStoryGroup = {
  ownerId: string;
  ownerTitle: string;
  isCenter: boolean;
  members: NewsCard[];
  /** 서버가 확인한 전체 건수. 응답 목록은 상한 때문에 더 짧을 수 있다. */
  total: number;
};

/**
 * 같은 소식의 다른 보도. 서버가 중심 또는 표시 노드와 직접 비교해 반복 정보로 판단한
 * 기사만 들어오며, 주변 기사 자리를 차지하지 않는다. 점수·관계 유형은 표시하지 않는다.
 */
export function SameStoryPanel({ groups, openId, onToggle, onOpenDetail, className = '' }: {
  groups: SameStoryGroup[];
  openId: string | null;
  onToggle: (ownerId: string, open: boolean) => void;
  onOpenDetail: (newsId: string) => void;
  className?: string;
}) {
  // 좁은 화면에서는 맵을 가리지 않도록 한 줄로 접어 두고, 노드 배지나 버튼으로 펼친다.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (openId) setExpanded(true);
  }, [openId]);
  if (groups.length === 0) return null;
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return (
    <section className={['story-panel', expanded && 'is-expanded', className].filter(Boolean).join(' ')}
      aria-label="같은 소식 다른 보도">
      <h2 className="story-panel-heading">같은 소식 다른 보도</h2>
      <button type="button" className="story-panel-toggle" aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}>
        같은 소식 다른 보도 {total}건
      </button>
      <div className="story-groups">
        {groups.map((group) => (
          <details
            key={group.ownerId}
            id={`story-${group.ownerId}`}
            open={openId === group.ownerId}
            onToggle={(event) => onToggle(group.ownerId, event.currentTarget.open)}
          >
            <summary>
              <span className="story-owner">{group.isCenter ? '중심 기사' : '주변 기사'}</span>
              <span className="story-owner-title">{group.ownerTitle}</span>
              <span className="story-count">다른 보도 {group.total}건</span>
            </summary>
            <ul>
              {group.members.map((news) => (
                <li key={news.id}>
                  <button type="button" onClick={() => onOpenDetail(news.id)}>
                    <span className="story-title">{news.title}</span>
                    <small>{[news.source, news.publishedAt].filter(Boolean).join(' · ')}</small>
                  </button>
                </li>
              ))}
            </ul>
            {group.total > group.members.length && (
              <p className="story-more">외 {group.total - group.members.length}건은 표시 상한으로 생략했습니다.</p>
            )}
          </details>
        ))}
      </div>
    </section>
  );
}
