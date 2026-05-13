import { beforeEach } from "vitest";

// Set up window.config for all tests
Object.defineProperty(window, "config", {
  value: { API_URL: "http://localhost:3000", WS_URL: "http://localhost:3000" },
  writable: true,
});

// Clear localStorage before each test to prevent state leakage between tests
beforeEach(() => {
  localStorage.clear();
});
