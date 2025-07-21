// Simple error categories for basic classification
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  BROWSER: 'browser',
  AI: 'ai',
  FILE: 'file',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  UNKNOWN: 'unknown',
};

export const RETRY_STRATEGIES = {
  NONE: 'none',
  LINEAR: 'linear',
  EXPONENTIAL: 'exponential',
};

export class EnhancedError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'EnhancedError';
    this.timestamp = new Date().toISOString();
    this.category = options.category || ERROR_CATEGORIES.UNKNOWN;
    this.context = options.context || {};
    this.originalError = options.originalError || null;
    this.shouldRetry =
      options.shouldRetry !== undefined ? options.shouldRetry : false;
    this.retryStrategy = options.retryStrategy || RETRY_STRATEGIES.NONE;
    this.maxRetries = options.maxRetries || 0;
    this.userMessage = options.userMessage || message;
    this.stackId = this._generateStackId();
  }

  _generateStackId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${this.category}_${timestamp}_${random}`;
  }

  /**
   * Get a simple error report
   */
  getReport() {
    return {
      id: this.stackId,
      timestamp: this.timestamp,
      message: this.message,
      userMessage: this.userMessage,
      category: this.category,
      shouldRetry: this.shouldRetry,
      retryStrategy: this.retryStrategy,
      maxRetries: this.maxRetries,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Simplified Global Error Handler Class
 */
export class GlobalErrorHandler {
  constructor(_options = {}) {
    this.errorStats = new Map();
  }

  /**
   * Simple error classification
   */
  classifyError(error) {
    // Simple error classification logic
    const errorType = this._classifyError(error);
    const shouldRetry = this._shouldRetry(errorType);

    // Determine retry strategy and max retries
    let retryStrategy = RETRY_STRATEGIES.NONE;
    let maxRetries = 0;

    if (shouldRetry) {
      if (
        errorType === ERROR_CATEGORIES.NETWORK ||
        errorType === ERROR_CATEGORIES.RATE_LIMIT
      ) {
        retryStrategy = RETRY_STRATEGIES.EXPONENTIAL;
        maxRetries = 3;
      } else {
        retryStrategy = RETRY_STRATEGIES.LINEAR;
        maxRetries = 2;
      }
    }

    // Simple user messages
    const userMessages = {
      [ERROR_CATEGORIES.NETWORK]: 'Network issue detected. Retrying...',
      [ERROR_CATEGORIES.BROWSER]: 'Browser error. Retrying...',
      [ERROR_CATEGORIES.AI]: 'AI service error. Continuing...',
      [ERROR_CATEGORIES.FILE]: 'File access error. Check permissions.',
      [ERROR_CATEGORIES.RATE_LIMIT]: 'Rate limit exceeded. Please wait.',
      [ERROR_CATEGORIES.TIMEOUT]: 'Operation timed out. Retrying...',
    };

    return {
      category: errorType,
      shouldRetry,
      retryStrategy,
      maxRetries,
      userMessage:
        userMessages[errorType] || 'An error occurred. Please try again.',
    };
  }

  /**
   * Handle error with simple processing
   */
  async handleError(error, context = {}) {
    const classification = this.classifyError(error);

    const enhancedError = new EnhancedError(error.message, {
      category: classification.category,
      shouldRetry: classification.shouldRetry,
      retryStrategy: classification.retryStrategy,
      maxRetries: classification.maxRetries,
      userMessage: classification.userMessage,
      context,
      originalError: error,
    });

    // Update error statistics
    this._updateErrorStats(enhancedError);

    // Simple logging
    console.error(`❌ [${enhancedError.category}] ${enhancedError.userMessage}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 2).join(' → ')}`);
    }

    return enhancedError;
  }

  /**
   * Update error statistics
   */
  _updateErrorStats(error) {
    const key = error.category;
    const current = this.errorStats.get(key) || {
      count: 0,
      lastOccurrence: null,
    };
    this.errorStats.set(key, {
      count: current.count + 1,
      lastOccurrence: error.timestamp,
      category: error.category,
    });
  }

  /**
   * Get simple error statistics summary
   */
  getErrorStats() {
    const stats = Array.from(this.errorStats.entries()).map(([key, value]) => ({
      category: key,
      ...value,
    }));

    return {
      totalErrors: stats.reduce((sum, stat) => sum + stat.count, 0),
      errorsByCategory: stats.reduce((acc, stat) => {
        acc[stat.category] = stat.count;
        return acc;
      }, {}),
      details: stats,
    };
  }

  /**
   * Reset error statistics
   */
  resetStats() {
    this.errorStats.clear();
  }

  /**
   * Simple error classification
   */
  _classifyError(error) {
    const message = error.message?.toLowerCase() || '';
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (message.includes('network') || message.includes('fetch') ||
        message.includes('timeout') || message.includes('connection') ||
        error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return ERROR_CATEGORIES.NETWORK;
    }

    // Browser errors
    if (message.includes('browser') || message.includes('page') ||
        message.includes('navigation') || stack.includes('puppeteer')) {
      return ERROR_CATEGORIES.BROWSER;
    }

    // AI/API errors
    if (message.includes('ai') || message.includes('api') ||
        message.includes('model') || message.includes('gemini')) {
      return ERROR_CATEGORIES.AI;
    }

    // File system errors
    if (message.includes('file') || message.includes('enoent') ||
        error.code === 'ENOENT' || error.code === 'EACCES') {
      return ERROR_CATEGORIES.FILE;
    }

    // Timeout errors
    if (message.includes('timeout') || error.code === 'ETIMEDOUT') {
      return ERROR_CATEGORIES.TIMEOUT;
    }

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429') ||
        error.status === 429) {
      return ERROR_CATEGORIES.RATE_LIMIT;
    }

    return ERROR_CATEGORIES.UNKNOWN;
  }

  /**
   * Determine if error should be retried
   */
  _shouldRetry(errorType) {
    const retryableErrors = [
      ERROR_CATEGORIES.NETWORK,
      ERROR_CATEGORIES.TIMEOUT,
      ERROR_CATEGORIES.BROWSER,
      ERROR_CATEGORIES.UNKNOWN
    ];
    return retryableErrors.includes(errorType);
  }
}

// Create a global instance
export const globalErrorHandler = new GlobalErrorHandler({
  enableConsoleColors: true,
  enableFileLogging: false, // Disabled for production - console logging only
  logDirectory: './logs/errors',
});

/**
 * Convenience function for handling errors
 */
export async function handleError(error, context = {}) {
  return await globalErrorHandler.handleError(error, context);
}

/**
 * Convenience function for creating enhanced errors
 */
export function createError(message, options = {}) {
  return new EnhancedError(message, options);
}

/**
 * Convenience function to check if error should be retried
 */
export function shouldRetryError(error) {
  if (error instanceof EnhancedError) {
    return error.shouldRetry;
  }

  const classification = globalErrorHandler.classifyError(error);
  return classification.shouldRetry;
}

/**
 * Get retry configuration for an error
 */
export function getRetryConfig(error) {
  if (error instanceof EnhancedError) {
    return {
      shouldRetry: error.shouldRetry,
      strategy: error.retryStrategy,
      maxRetries: error.maxRetries,
    };
  }

  const classification = globalErrorHandler.classifyError(error);
  return {
    shouldRetry: classification.shouldRetry,
    strategy: classification.retryStrategy,
    maxRetries: classification.maxRetries,
  };
}
