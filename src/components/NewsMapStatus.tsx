import type { NewsMapSelection } from '../data/mockData';

/**
 * 뉴스맵 상태 안내. 로딩·추가 검색·오류·부분 결과·정상적인 결과 부족을 구분한다.
 * 개수를 채우려 하지 않으므로 적은 결과도 정상 상태로 설명한다.
 */
export function NewsMapStatus({ count, pending, error, findingMore = false, selection, grouped = 0 }: {
  count: number;
  pending: boolean;
  error: string | null;
  /** 최초 결과를 표시한 뒤 서버가 추가 후보를 평가하는 중 */
  findingMore?: boolean;
  selection?: NewsMapSelection;
  /** 화면에 묶여 표시되는 같은 소식 다른 보도 수 */
  grouped?: number;
}) {
  if (pending) return null;
  if (error) return <p className="map-status" role="alert">{error}</p>;
  if (findingMore) {
    return (
      <p className="map-status" role="status" aria-live="polite">
        추가 관련 기사를 찾는 중… 현재 {count}개를 표시합니다.
      </p>
    );
  }
  const requested = selection?.requested ?? 3;
  if (selection?.status === 'partial') {
    return (
      <p className="map-status is-warning" role="status">
        추가 관련 기사 검색을 마치지 못했습니다. 확인된 {count}개만 표시합니다.
      </p>
    );
  }
  if (count >= requested) return null;
  const groupedNote = grouped > 0 ? ` 같은 소식의 다른 보도 ${grouped}건은 묶어 두었습니다.` : '';
  return (
    <p className="map-status" role="status">
      {count === 0
        ? `연결할 연관 기사가 없습니다. 다른 검색어나 중심 기사로 탐색해 보세요.${groupedNote}`
        : `연관 기사 ${count}개를 표시합니다. 관련 기사만 연결하므로 개수가 적을 수 있습니다.${groupedNote}`}
    </p>
  );
}
