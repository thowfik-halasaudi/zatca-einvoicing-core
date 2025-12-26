import { HttpStatus } from "@nestjs/common";

/**
 * API Response Helper
 *
 * A utility function used by controllers to construct a standardized response object.
 * Acts as the contract between Controllers and the ResponseInterceptor.
 */
export interface ApiResponseOptions {
  key?: string;
  data?: any;
  status?: number | string;
  request?: any;
}

/**
 * Standardized response helper.
 * Use this in controllers to return structured data with custom messages and status codes.
 * The Global ResponseInterceptor will handle the final formatting and localization.
 */
export function apiResponse({
  key = "common.success",
  data = null,
  status = HttpStatus.OK,
  request = null,
}: ApiResponseOptions) {
  return {
    messageKey: key,
    data,
    status,
    // we don't need to return request as Interceptor has access to context
  };
}
