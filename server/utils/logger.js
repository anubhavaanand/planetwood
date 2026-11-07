// Structured JSON logger with request-id correlation for Planetwood relay server.
// All log entries include: level, timestamp, requestId, message, and optional context.
export class Logger {
  constructor({ service = 'planetwood-relay', level = 'info' } = {}) {
    this.service = service;
    this.level = level;
    this.requestId = null;
  }

  // Set a request ID for correlation across subsequent log calls in this request.
  setRequestId(requestId) {
    this.requestId = requestId;
  }

  // Clear the request ID (end of request scope).
  clearRequestId() {
    this.requestId = null;
  }

  // Generate a correlation-safe request ID.
  static generateRequestId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  }

  levelPriority(name) {
    const order = { error: 0, warn: 1, info: 2, debug: 3 };
    return order[name] ?? 2;
  }

  shouldLog(level) {
    return this.levelPriority(level) <= this.levelPriority(this.level);
  }

  log(level, message, context = {}) {
    if (!this.shouldLog(level)) return;
    const entry = {
      level,
      timestamp: new Date().toISOString(),
      service: this.service,
      requestId: this.requestId || null,
      message,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.info(line);
    }
  }

  error(message, context = {}) {
    this.log('error', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  info(message, context = {}) {
    this.log('info', message, context);
  }

  debug(message, context = {}) {
    this.log('debug', message, context);
  }
}

export const logger = new Logger();
