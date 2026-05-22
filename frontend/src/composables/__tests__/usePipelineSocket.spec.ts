import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
};

vi.mock("socket.io-client", () => ({ io: vi.fn(() => mockSocket) }));

describe("usePipelineSocket", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // @ts-ignore mock compatibility
    window.config = {
      API_URL: "http://localhost:3000",
      WS_URL: "http://localhost:3000",
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on connect: calls io(window.config.WS_URL + "/pipeline", { auth: { token } })', async () => {
    // Arrange
    const { io } = await import("socket.io-client");
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";

    // Act
    usePipelineSocket(token);

    // Assert
    expect(io).toHaveBeenCalledWith("http://localhost:3000/pipeline", {
      auth: { token },
    });
  });

  it('registers listener for "pipeline.created" event', async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";

    // Act
    usePipelineSocket(token);

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith(
      "pipeline.created",
      expect.any(Function),
    );
  });

  it('registers listener for "pipeline.updated" event', async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";

    // Act
    usePipelineSocket(token);

    // Assert
    expect(mockSocket.on).toHaveBeenCalledWith(
      "pipeline.updated",
      expect.any(Function),
    );
  });

  it('onCreated callback is called with payload when "pipeline.created" fires', async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";
    const { onCreated } = usePipelineSocket(token);

    const createdCallback = vi.fn();
    onCreated(createdCallback);

    // Find the handler registered for 'pipeline.created'
    const registeredHandler = (
      mockSocket.on as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (call: [string, unknown]) => call[0] === "pipeline.created",
    )?.[1] as ((...args: unknown[]) => void) | undefined;

    const payload = {
      id: "p-new",
      app: "whiz-server",
      status: "Queued",
    };

    // Act — simulate socket emitting the event
    registeredHandler?.(payload);

    // Assert
    expect(createdCallback).toHaveBeenCalledWith(payload);
  });

  it('onUpdated callback is called with payload when "pipeline.updated" fires', async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";
    const { onUpdated } = usePipelineSocket(token);

    const updatedCallback = vi.fn();
    onUpdated(updatedCallback);

    // Find the handler registered for 'pipeline.updated'
    const registeredHandler = (
      mockSocket.on as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (call: [string, unknown]) => call[0] === "pipeline.updated",
    )?.[1] as ((...args: unknown[]) => void) | undefined;

    const payload = {
      id: "p1",
      app: "whiz-server",
      status: "Running",
    };

    // Act — simulate socket emitting the event
    registeredHandler?.(payload);

    // Assert
    expect(updatedCallback).toHaveBeenCalledWith(payload);
  });

  it("disconnect() calls socket.disconnect()", async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";
    const { disconnect } = usePipelineSocket(token);

    // Act
    disconnect();

    // Assert
    expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
  });

  // ─── Regression tests ────────────────────────────────────────────────────────

  it("REG-1: after first connect, a second connect event (reconnect) triggers the registered onReconnect callback", async () => {
    // Arrange
    const { usePipelineSocket } = await import("../usePipelineSocket");
    const token = "test-access-token";
    const socket = usePipelineSocket(token);

    // onReconnect must be exposed — current code does NOT expose it → RED
    expect(typeof (socket as any).onReconnect).toBe("function");

    const reconnectCallback = vi.fn();
    (socket as any).onReconnect(reconnectCallback);

    // Find the "connect" handler registered on the socket
    const connectHandler = (
      mockSocket.on as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      (call: [string, unknown]) => call[0] === "connect",
    )?.[1] as ((...args: unknown[]) => void) | undefined;

    // Simulate reconnect: fire "connect" a second time (first = initial connect)
    connectHandler?.(); // first connect
    connectHandler?.(); // second connect = reconnect

    // Assert — callback must have been invoked at least once (on reconnect)
    expect(reconnectCallback).toHaveBeenCalled();
  });
});
