/**
 * API Helper - Wrapper with proper error handling & timeout
 */

const DEFAULT_TIMEOUT_MS = 30000;
const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Lỗi tùy chỉnh cho API
 */
export class APIError extends Error {
  constructor(message, code = 'UNKNOWN', statusCode = null, originalError = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

/**
 * Helper: Convert HTTP status code to user-friendly Vietnamese message
 */
function getHttpErrorMessage(statusCode) {
  const messages = {
    400: 'Yêu cầu không hợp lệ. Vui lòng kiểm tra thông tin.',
    401: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.',
    403: 'Bạn không có quyền thực hiện hành động này.',
    404: 'Không tìm thấy nội dung yêu cầu.',
    409: 'Thông tin xung đột. Vui lòng thử lại.',
    429: 'Quá nhiều yêu cầu. Vui lòng chờ một chút.',
    500: 'Lỗi máy chủ. Vui lòng thử lại sau.',
    502: 'Lỗi kết nối. Vui lòng kiểm tra kết nối mạng.',
    503: 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
  };
  return messages[statusCode] || `Lỗi ${statusCode}. Vui lòng thử lại.`;
}

/**
 * Helper: Format error message based on error type
 */
function formatErrorMessage(error, defaultMessage) {
  if (error instanceof APIError) {
    return error.message;
  }
  if (error?.message?.includes('Network')) {
    return 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng của bạn.';
  }
  if (error?.message?.includes('timeout') || error?.message?.includes('Timeout')) {
    return 'Yêu cầu hết thời gian. Vui lòng thử lại.';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error?.message || defaultMessage;
}

/**
 * Main API request function with error handling
 * @param {string} path - API endpoint path
 * @param {object} options - Fetch options
 * @param {string} token - Auth token
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<object>} - Parsed JSON response
 * @throws {APIError} - Custom error with details
 */
export async function apiRequest(
  path,
  options = {},
  token = null,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${options.baseUrl || ''}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await response.text().catch(() => '');
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new APIError(
        getHttpErrorMessage(response.status),
        'PARSE_ERROR',
        response.status,
        e
      );
    }

    if (!response.ok) {
      const errorMessage =
        json?.message ||
        json?.error?.message ||
        getHttpErrorMessage(response.status);

      throw new APIError(errorMessage, 'HTTP_ERROR', response.status);
    }

    return json;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error.name === 'AbortError') {
      throw new APIError(
        'Yêu cầu hết thời gian. Vui lòng kiểm tra kết nối mạng và thử lại.',
        'TIMEOUT_ERROR',
        null,
        error
      );
    }

    if (error.message.includes('Network request failed')) {
      throw new APIError(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
        'NETWORK_ERROR',
        null,
        error
      );
    }

    throw new APIError(
      error.message || 'Lỗi không xác định. Vui lòng thử lại.',
      'UNKNOWN_ERROR',
      null,
      error
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safe wrapper for API calls
 * @param {Function} apiCall - Async function that makes API request
 * @param {string} defaultErrorMessage - Default error message if no specific error
 * @returns {Promise<{success: boolean, data: any, error: string|null}>}
 */
export async function safeApiCall(apiCall, defaultErrorMessage = 'Lỗi không xác định') {
  try {
    const result = await apiCall();
    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    const errorMessage = formatErrorMessage(error, defaultErrorMessage);
    return {
      success: false,
      data: null,
      error: errorMessage,
    };
  }
}

export default {
  apiRequest,
  safeApiCall,
  APIError,
};
