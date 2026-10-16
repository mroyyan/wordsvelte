import { createRateLimiter } from './rate-limit'

const LOGIN_WINDOW_MS = 15 * 60 * 1000

/** Failed logins per client address / per target email. */
export const loginByIp = createRateLimiter({ max: 30, windowMs: LOGIN_WINDOW_MS })
export const loginByEmail = createRateLimiter({ max: 5, windowMs: LOGIN_WINDOW_MS })

/** Public comment submissions per client address. */
export const commentLimiter = createRateLimiter({ max: 5, windowMs: 60 * 1000 })
