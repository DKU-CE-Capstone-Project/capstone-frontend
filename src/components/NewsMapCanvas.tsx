import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crosshair } from 'lucide-react';
import type { NewsCard } from '../data/mockData';
import { connectionPath, layoutNewsMap, pickNewsProfile } from '../layout/mapLayout';
import { fitScale, useFieldSize } from '../layout/useFieldScale';
import { edgeVariants, floatAnimation, springBouncy, springSnappy, useMotionSafe } from '../motion/presets';
import { SmartImage } from './ui';

/**
 * 중심 뉴스 + 연관 뉴스 맵.
 *
 * 기존 대비 달라진 것
 * - 노드 좌표를 mapLayout이 계산한다 → 연관 뉴스 3개 고정 제한이 사라짐
 * - 연결선이 실제 노드 좌표에서 생성된다 → 기존에는 viewBox 0~100에 path 3개가 리터럴
 * - 연관 노드를 누르면 중심이 교체되고 나머지가 재배치된다 (기존에는 탐색 불가)
 * - 원 전체가 클릭 대상이다 (기존에는 지름 30px "상세" 버튼만 눌렸다)
 */
export function NewsMapCanvas({
  centerNews,
  relatedNews,
  compact = false,
  onOpenDetail,
  onFocusNews,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  compact?: boolean;
  onOpenDetail: (newsId: string) => void;
  onFocusNews?: (newsId: string) => void;
}) {
  const { ref, size } = useFieldSize();
  const motionSafe = useMotionSafe();
  const [hovered, setHovered] = useState<string | null>(null);

  const profile = pickNewsProfile(size.width || 960, compact);
  const scale = fitScale(size, profile.field);

  const byId = new Map<string, NewsCard>([
    [centerNews.id, centerNews],
    ...relatedNews.map((news) => [news.id, news] as const),
  ]);
  const nodes = layoutNewsMap(
    centerNews.id,
    relatedNews.map((news) => news.id),
    profile,
  );
  const [center, ...related] = nodes;

  return (
    <div className={`news-map-field${compact ? ' is-compact' : ''}`} ref={ref}>
      <div
        className="map-stage"
        style={{
          width: profile.field.width,
          height: profile.field.height,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <svg
          className="edge-layer"
          viewBox={`0 0 ${profile.field.width} ${profile.field.height}`}
          aria-hidden="true"
        >
          <AnimatePresence>
            {related.map((node, i) => (
              <motion.path
                key={`${center.id}->${node.id}`}
                className={hovered === node.id ? 'edge is-active' : 'edge'}
                d={connectionPath(center, node)}
                variants={edgeVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ delay: motionSafe ? 0.08 * i : 0 }}
              />
            ))}
          </AnimatePresence>
        </svg>

        <AnimatePresence initial={false}>
          {nodes.map((node, i) => {
            const news = byId.get(node.id);
            if (!news) return null;

            const dimmed = hovered !== null && hovered !== node.id;
            const isCenter = node.isCenter;
            // pill("상세")은 원 안에서 자리를 차지한다. 원이 작으면 출처 텍스트를
            // 덮으므로 빼고, 그때는 노드 자체가 상세 버튼이 된다. 중심 교체는
            // pill 이 있는 자리에서만 — 상세로 들어갈 길이 남아 있어야 한다.
            // 미니맵(compact)은 다른 기사의 상세로 건너뛰는 용도라 항상 제외한다.
            //
            // 기준이 지름 210 이었는데, 연관 뉴스가 5~6개면 데스크톱 노드도 201px 로
            // 줄어 중심 교체와 pill 이 통째로 사라졌다. 실제 백엔드는 /related(FREE
            // 3건) + /graph 보충으로 보통 5~6개를 주므로, 정상 상황에서 맵 탐색이
            // 막히는 셈이었다. 모바일(124px)은 예전처럼 노드를 누르면 상세로 간다.
            const showPill = !compact && node.size >= 160;
            const canFocus = !isCenter && showPill && !!onFocusNews;

            return (
              <motion.div
                key={node.id}
                className={`news-node-slot${isCenter ? ' is-center' : ''}`}
                initial={{
                  opacity: 0,
                  scale: 0.4,
                  x: center.x - node.size / 2,
                  y: center.y - node.size / 2,
                }}
                animate={{
                  opacity: dimmed ? 0.5 : 1,
                  scale: 1,
                  x: node.x - node.size / 2,
                  y: node.y - node.size / 2,
                  width: node.size,
                  height: node.size,
                }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.16 } }}
                transition={{ ...springBouncy, delay: motionSafe ? i * 0.05 : 0 }}
              >
                <motion.div
                  className="news-node-float"
                  animate={motionSafe && !isCenter ? floatAnimation(i, 5) : undefined}
                >
                  <motion.button
                    type="button"
                    className={`news-node tone-${news.thumbnailTone}${isCenter ? ' is-center' : ''}${canFocus ? ' is-focusable' : ''}`}
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={springSnappy}
                    onHoverStart={() => setHovered(node.id)}
                    onHoverEnd={() => setHovered(null)}
                    onFocus={() => setHovered(node.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => {
                      setHovered(null);
                      if (canFocus) onFocusNews(node.id);
                      else onOpenDetail(node.id);
                    }}
                    aria-label={
                      canFocus
                        ? `${news.title} — 맵 중심으로 이동`
                        : `${news.title} — 뉴스 상세 보기`
                    }
                  >
                    <SmartImage
                      className="node-image"
                      src={news.imageUrl}
                      alt=""
                      eager={isCenter}
                    />
                    <span className="node-copy">
                      <strong style={{ fontSize: node.titleFont }}>{news.title}</strong>
                      {news.source && (
                        <small style={{ fontSize: node.metaFont }}>{news.source}</small>
                      )}
                      {canFocus && (
                        <span
                          className="node-focus-hint"
                          style={{ fontSize: node.metaFont }}
                          aria-hidden="true"
                        >
                          <Crosshair size={12} />
                          중심으로
                        </span>
                      )}
                    </span>
                  </motion.button>

                  {/* 원 전체와 겹치지 않는 별도 버튼 — 버튼 중첩은 유효하지 않은 마크업이라 형제로 둔다 */}
                  {showPill && (
                  <motion.button
                    type="button"
                    className="node-detail-pill"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    transition={springSnappy}
                    onClick={() => onOpenDetail(node.id)}
                    aria-label={`${news.title} 상세 보기`}
                  >
                    상세
                  </motion.button>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
