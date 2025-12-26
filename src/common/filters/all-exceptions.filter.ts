/**
 * Global Exception Filter
 *
 * Catches all application errors (HTTP, Database, System) and converts them
 * into a standardized JSON error response with localized messages.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const i18n = I18nContext.current();
    const lang = i18n ? i18n.lang : "en";

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Determine Message Key
    let messageKey = "common.errors.server_error";
    if (typeof exceptionResponse === "object" && exceptionResponse?.message) {
      // If validation error (array), take first or generic
      messageKey = Array.isArray(exceptionResponse.message)
        ? "common.errors.bad_request"
        : exceptionResponse.message;

      // If the message is a real key (contains dot), use it.
      // Otherwise, keep it as is if it's a raw string message?
      // PMS pattern usually expects specific keys.
      // For now, we assume if it has no spaces and has a dot, it's a key.
    } else if (typeof exceptionResponse === "string") {
      messageKey = exceptionResponse;
    }

    // Try to translate. If missing, use the key itself or fallback
    const message = i18n
      ? i18n.t(messageKey, { defaultValue: messageKey })
      : "Internal Server Error";

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Status ${status} Error: ${JSON.stringify(exception)}`);
    }

    response.status(status).json({
      success: false,
      key: messageKey,
      message: message,
      status: status,
      data: null,
      lang: lang,
    });
  }
}
