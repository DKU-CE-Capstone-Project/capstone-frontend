/** Explain fewer neighbours while preserving a useful center article. */
export function NewsMapStatus({ count, pending, error }: {
  count: number;
  pending: boolean;
  error: string | null;
}) {
  if (pending) return null;
  if (error) return <p className="map-status" role="alert">{error}</p>;
  if (count >= 3) return null;
  return (
    <p className="map-status" role="status">
      {count === 0
        ? '연결할 연관 기사가 없습니다. 다른 검색어나 중심 기사로 탐색해 보세요.'
        : `연관 기사 ${count}개를 표시합니다. 관련 기사만 연결하므로 개수가 적을 수 있습니다.`}
    </p>
  );
}
