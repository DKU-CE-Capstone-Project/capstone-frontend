import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ImageOff, Lock, Moon, Sun, X } from 'lucide-react';
import {
  easeOut,
  overlayVariants,
  springSnappy,
  toastVariants,
  useMotionSafe,
} from '../motion/presets';

// ── 테마 토글 ───────────────────────────────────────────────────────
export function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={springSnappy}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'dark' : 'light'}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={easeOut}
          style={{ display: 'flex' }}
        >
          {isDark ? (
            <Moon size={18} aria-hidden="true" />
          ) : (
            <Sun size={18} aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// ── 로딩 오버레이 ───────────────────────────────────────────────────
/**
 * 기존에는 "🔍 뉴스 분석 중…" 박스 하나가 전부였다.
 * 어떤 단계가 진행 중인지 보여주고, 맵 화면에서는 스켈레톤으로 자리를 잡아준다.
 */
export function LoadingOverlay({ label }: { label: string }) {
  const motionSafe = useMotionSafe();

  return (
    <motion.div
      className="loading-overlay"
      variants={overlayVariants}
      initial="enter"
      animate="center"
      exit="exit"
      role="status"
      aria-live="polite"
    >
      <div className="loading-card">
        <span className="loading-spinner" aria-hidden="true">
          <motion.span
            className="loading-spinner-arc"
            animate={motionSafe ? { rotate: 360 } : undefined}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        </span>
        <span className="loading-label">{label}</span>
      </div>
    </motion.div>
  );
}

// ── 맵 스켈레톤 ─────────────────────────────────────────────────────
const SKELETON_NODES = [
  { size: 208, x: 50, y: 50 },
  { size: 118, x: 68, y: 29 },
  { size: 118, x: 32, y: 29 },
  { size: 86, x: 50, y: 10 },
  { size: 86, x: 88, y: 50 },
];

export function MapSkeleton() {
  const motionSafe = useMotionSafe();

  return (
    <div className="map-skeleton" aria-hidden="true">
      {SKELETON_NODES.map((node, i) => (
        <motion.span
          key={i}
          className="map-skeleton-node"
          style={{
            width: node.size,
            height: node.size,
            left: `${node.x}%`,
            top: `${node.y}%`,
          }}
          animate={motionSafe ? { opacity: [0.35, 0.75, 0.35] } : undefined}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.12,
          }}
        />
      ))}
    </div>
  );
}

// ── 토스트 ──────────────────────────────────────────────────────────
/**
 * 기존 errorMsg는 검색 결과 화면에만 렌더돼서, 홈·상세·리포트에서 발생한
 * 에러는 state에 저장만 되고 사용자에게 보이지 않았다. 이제 셸 레벨에서 띄운다.
 */
export function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="toast"
          variants={toastVariants}
          initial="enter"
          animate="center"
          exit="exit"
          role="alert"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{message}</span>
          <button type="button" onClick={onDismiss} aria-label="알림 닫기">
            <X size={14} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 이미지 ──────────────────────────────────────────────────────────
/**
 * 백엔드 thumbnail_url이 404이거나 외부 이미지 호스트가 막히면 기존에는
 * 깨진 이미지 아이콘이 그대로 노출됐다. 로드 실패 시 톤 배경으로 대체한다.
 */
type SmartImageProps = {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
};

export function SmartImage(props: SmartImageProps) {
  return <ImageForSource key={props.src} {...props} />;
}

function ImageForSource({
  src,
  alt,
  className,
  eager = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`${className ?? ''} image-fallback`}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <ImageOff size={18} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

// ── 빈 상태 ─────────────────────────────────────────────────────────
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
    </div>
  );
}

/** 로그인·결제·연관도 상세·심화 분석은 이번 v2 범위 밖이다. */
export function PremiumPreview({ maxArticles }: { maxArticles: number }) {
  return (
    <aside className="premium-preview" aria-label="현재 리포트 한도">
      <div className="premium-header">
        <Lock size={14} aria-hidden="true" />
        <strong>리포트 근거 {maxArticles}건</strong>
      </div>
      <span>
        {maxArticles === 1 ? '무료 · 선택 1건' : '프로토타입 유료 설정'}
      </span>
      <button type="button" disabled>
        연관도 상세 · 준비 중
      </button>
      <button type="button" disabled>
        심화 리포트 · 준비 중
      </button>
    </aside>
  );
}
