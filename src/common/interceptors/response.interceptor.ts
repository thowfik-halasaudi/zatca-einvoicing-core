/**
 * Global Response Interceptor
 *
 * Intercepts all outgoing responses to standardize the API format.
 * Automatically wraps data in { status, message, data } and handles i18n translation.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { I18nContext } from "nestjs-i18n";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();

        console.log("ResponseInterceptor intercepted:", data); // DEBUG LOG

        // Allow controller to return object with specific key, otherwise default
        const responseKey = data?.messageKey || "common.success";

        // Check if controller returned an explicit status (e.g., "CREATED", "SUCCESS")
        let statusCode = response.statusCode;
        if (data?.status) {
          const { getStatusCode } = require("../utils/status-codes"); // Dynamic import to avoid circular dep if any
          const resolvedStatus = getStatusCode(data.status);
          if (resolvedStatus) {
            statusCode = resolvedStatus;
            response.status(statusCode); // Update actual HTTP status
          }
        }

        // Get i18n context
        const i18n = I18nContext.current();
        const lang = i18n ? i18n.lang : "en";
        const message = i18n ? i18n.t(responseKey) : "Operation successful";

        // Handle if controller returns { data: ... } or just raw data
        const responseData = data?.data !== undefined ? data.data : data;

        return {
          success: true,
          key: responseKey,
          message: message,
          status: statusCode,
          data: responseData,
          lang: lang,
        };
      })
    );
  }
}
