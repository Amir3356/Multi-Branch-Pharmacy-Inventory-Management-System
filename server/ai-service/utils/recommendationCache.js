/**
 * Recommendations per user (see services/ai.service.js). Laravel kept these in its cache store; here they live in this
 * service's memory (lost on restart, which only means one extra AI call).
 */
export const recommendationCache = new Map()
