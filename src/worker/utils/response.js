/**
 * Create a JSON response with the given data and status code
 * @param {*} data - The response data
 * @param {number} [status=200] - The HTTP status code
 * @param {Object} [headers={}] - Additional headers to include
 * @returns {Response} A Response object with JSON body
 */
export function jsonResponse(data, status = 200, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        ...defaultHeaders,
        ...headers
      }
    }
  );
}

/**
 * Create an error response
 * @param {string} message - The error message
 * @param {number} [status=400] - The HTTP status code
 * @param {Object} [details={}] - Additional error details
 * @returns {Response} A Response object with error details
 */
export function errorResponse(message, status = 400, details = {}) {
  return jsonResponse(
    {
      success: false,
      error: message,
      ...details
    },
    status
  );
}

/**
 * Create a success response
 * @param {*} data - The response data
 * @param {number} [status=200] - The HTTP status code
 * @returns {Response} A Response object with success status and data
 */
export function successResponse(data, status = 200) {
  return jsonResponse(
    {
      success: true,
      data
    },
    status
  );
}

/**
 * Create a not found response
 * @param {string} [message='Resource not found'] - The error message
 * @returns {Response} A 404 Response object
 */
export function notFoundResponse(message = 'Resource not found') {
  return errorResponse(message, 404);
}

/**
 * Create an unauthorized response
 * @param {string} [message='Unauthorized'] - The error message
 * @returns {Response} A 401 Response object
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

/**
 * Create a forbidden response
 * @param {string} [message='Forbidden'] - The error message
 * @returns {Response} A 403 Response object
 */
export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 403);
}

/**
 * Create a bad request response
 * @param {string} [message='Bad Request'] - The error message
 * @param {Object} [errors={}] - Validation errors or additional details
 * @returns {Response} A 400 Response object
 */
export function badRequestResponse(message = 'Bad Request', errors = {}) {
  return errorResponse(
    message,
    400,
    Object.keys(errors).length > 0 ? { errors } : {}
  );
}
