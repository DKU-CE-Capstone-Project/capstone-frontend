import { useState } from 'react';
import { motion } from 'motion/react';
import { layoutKeywordMap, orbitRings, pickKeywordProfile } from '../layout/mapLayout';
import { fitScale, useFieldSize } from '../layout/useFieldScale';
import {
  floatAnimation,
  mapNodeVariants,
  springSnappy,
  staggerContainer,
  useMotionSafe,
} from '../motion/presets';

/**
 * 검색어(중심) + 추천 키워드(궤도) 맵.
 *
 * 좌표는 mapLayout이 계산한다 — CSS에 `.keyword-map-node-0 ~ -10`을 하드코딩하던
 * 방식에서 벗어나면서 11개 제한과 브레이크포인트 중복이 사라졌다.
 */
export function KeywordMap({
  keywords,
  onSelect,
}: {
  keywords: string[];
  onSelect: (keyword: string) => void;
}) {
  const { ref, size } = useFieldSize();
  const motionSafe = useMotionSafe();
  const [hovered, setHovered] = useState<number | null>(null);

  const profile = pickKeywordProfile(size.width || 930);
  const scale = fitScale(size, profile.field);
  const nodes = layoutKeywordMap(keywords, profile);

  return (
    <div className="orbit-field" ref={ref}>
      {/*
        transform은 Motion이 소유하므로 CSS transform 문자열 대신 x/y/scale 스타일 값으로 넘긴다.
        (문자열로 주면 자식 variants가 동작할 때 덮어써질 수 있다)
      */}
      <motion.div
        className="map-stage"
        style={{
          width: profile.field.width,
          height: profile.field.height,
          x: '-50%',
          y: '-50%',
          scale,
        }}
        variants={staggerContainer(0.07, 0.08)}
        initial="enter"
        animate="center"
      >
        <svg
          className="orbit-layer"
          viewBox={`0 0 ${profile.field.width} ${profile.field.height}`}
          aria-hidden="true"
        >
          {orbitRings(profile).map((ring, i) => (
            <motion.ellipse
              key={i}
              cx={profile.field.width / 2}
              cy={profile.field.height / 2}
              rx={ring.rx}
              ry={ring.ry}
              strokeDasharray="6 10"
              initial={{ opacity: 0 }}
              animate={motionSafe ? { opacity: 1, strokeDashoffset: [0, -160] } : { opacity: 1 }}
              transition={{
                opacity: { duration: 0.5, delay: i * 0.1 },
                strokeDashoffset: { duration: 14 + i * 5, repeat: Infinity, ease: 'linear' },
              }}
            />
          ))}
        </svg>

        {nodes.map((node) => {
          const isCenter = node.rank === 0;
          const dimmed = hovered !== null && hovered !== node.rank;

          return (
            <motion.div
              key={`${node.keyword}-${node.rank}`}
              className="keyword-node-slot"
              style={{ left: node.x, top: node.y, x: '-50%', y: '-50%' }}
              variants={mapNodeVariants}
            >
              <motion.div
                animate={motionSafe && !isCenter ? floatAnimation(node.rank, 5) : undefined}
              >
                <motion.button
                  type="button"
                  className={`keyword-node${isCenter ? ' is-center' : ''}`}
                  style={{ width: node.size, height: node.size, fontSize: node.fontSize }}
                  animate={{ opacity: dimmed ? 0.45 : 1 }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.96 }}
                  transition={springSnappy}
                  onHoverStart={() => setHovered(node.rank)}
                  onHoverEnd={() => setHovered(null)}
                  onFocus={() => setHovered(node.rank)}
                  onBlur={() => setHovered(null)}
                  onClick={() => onSelect(node.keyword)}
                  aria-label={`${node.keyword} 관련 뉴스맵 열기`}
                >
                  <span>{node.keyword}</span>
                </motion.button>
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
