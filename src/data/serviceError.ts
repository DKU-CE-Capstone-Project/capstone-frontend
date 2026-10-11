import type { ErrorDetail } from './newsMapService';

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly detail?: ErrorDetail,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
