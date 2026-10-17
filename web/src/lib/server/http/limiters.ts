import { createRateLimiter } from './rate-limit'

const LOGIN_WINDOW_MS = 15 * 60 * 1000

/** Failed logins per client address / per target email. */
export const loginByIp = createRateLimiter({ max: 30, windowMs: LOGIN_WINDOW_MS })
export const loginByEmail = createRateLimiter({ max: 5, windowMs: LOGIN_WINDOW_MS })

/** Public comment submissions per client address. */
export const commentLimiter = createRateLimiter({ max: 5, windowMs: 60 * 1000 })

/** Password reset requests: per target email and per client address. */
export const forgotByEmail = createRateLimiter({ max: 3, windowMs: LOGIN_WINDOW_MS })
export const forgotByIp = createRateLimiter({ max: 10, windowMs: LOGIN_WINDOW_MS })
export const resetByIp = createRateLimiter({ max: 20, windowMs: LOGIN_WINDOW_MS })

/** Failed second-factor attempts per account / per client address, and verification emails requested per account. */
export const twoFactorByUser = createRateLimiter({ max: 8, windowMs: LOGIN_WINDOW_MS })
export const twoFactorByIp = createRateLimiter({ max: 40, windowMs: LOGIN_WINDOW_MS })
export const twoFactorSendByUser = createRateLimiter({ max: 5, windowMs: LOGIN_WINDOW_MS })

/** Wrong "current password" answers on the account pages (a stolen session must not be able to guess it). */
export const accountPasswordByUser = createRateLimiter({ max: 8, windowMs: LOGIN_WINDOW_MS })

/** Banner clicks counted per client address (the redirect itself is never blocked). */
export const adClickByIp = createRateLimiter({ max: 30, windowMs: 60 * 1000 })
