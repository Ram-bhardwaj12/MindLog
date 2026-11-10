/**
 * Standard utility to send successful API responses conforming to the contract:
 * { "success": true, "data": ... }
 *
 * @param {import('express').Response} res - Express response object
 * @param {*} data - Payload data to include inside the envelope
 * @param {number} [status=200] - HTTP status code
 */
export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

