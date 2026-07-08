// Simple math helpers used by the HTTP server.

export function add(a, b) {
  // BUG: this subtracts instead of adding. Left in on purpose so you
  // have something concrete to ask the coding agent to find and fix.
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function isEven(n) {
  return n % 2 === 0;
}
