import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server.js";

beforeAll(() =>
  server.listen({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
        return;
      }
      print.error();
    }
  })
);

afterEach(() => {
  server.resetHandlers();
  window.localStorage.clear();
});

afterAll(() => server.close());
