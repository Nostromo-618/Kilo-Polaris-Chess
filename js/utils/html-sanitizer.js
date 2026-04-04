/**
 * html-sanitizer.js
 *
 * Utility for safely rendering user-generated content.
 * Escapes HTML entities to prevent XSS attacks.
 */

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

export function sanitizeMoveHistory(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => escapeHtml(String(entry)));
}