/**
 * Core pure utilities for formatting text and dates in Neev
 * Free of native / Reanimated dependencies so they are safely testable.
 */

export function toLocalDateInput(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function makeExcerpt(text: string, maxLength = 80): string {
  const normalized = text.trim()
  if (normalized.length <= maxLength) return normalized
  const limit = Math.max(1, maxLength - 1)
  const boundary = normalized.lastIndexOf(" ", limit)
  const cutAt = boundary >= Math.floor(limit * 0.6) ? boundary : limit
  return `${normalized.slice(0, cutAt).trimEnd()}…`
}
