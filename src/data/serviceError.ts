import type { ErrorDetail } from './newsMapService';

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly detail?: ErrorDetail,
    readonly retryAfterSeconds?: number,
  ) {
    super(
      status === 429
        ? retryAfterSeconds && retryAfterSeconds > 0
          ? `요청 한도를 초과했습니다. 약 ${retryAfterSeconds}초 후 다시 시도해 주세요.`
          : '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
        : message,
    );
    this.name = 'ServiceError';
  }
}
