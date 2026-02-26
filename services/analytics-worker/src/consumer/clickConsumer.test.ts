// ─── Mocks must be declared before any imports ────────────
const mockChannel = {
  consume: jest.fn(),
  ack: jest.fn(),
  nack: jest.fn(),
  prefetch: jest.fn(),
  assertQueue: jest.fn(),
  sendToQueue: jest.fn(),
};

jest.mock("../config/rabbitmq", () => ({
  __esModule: true,
  connectRabbitMQ: jest.fn().mockResolvedValue(undefined),
  getChannel: jest.fn().mockReturnValue(mockChannel),
  checkRabbitMQHealth: jest.fn().mockReturnValue("ok"),
  disconnectRabbitMQ: jest.fn().mockResolvedValue(undefined),
}));

const mockClickEventCreate = jest.fn();

jest.mock("../models/ClickEvent", () => ({
  __esModule: true,
  default: {
    create: mockClickEventCreate,
  },
}));

import { startConsumer } from "./clickConsumer";
import { ConsumeMessage } from "amqplib";

// ─── Helpers ──────────────────────────────────────────────
// Build a fake RabbitMQ message
const makeMessage = (content: object | string): ConsumeMessage => ({
  content: Buffer.from(
    typeof content === "string" ? content : JSON.stringify(content),
  ),
  fields: {
    deliveryTag: 1,
    redelivered: false,
    exchange: "",
    routingKey: "click_events",
    consumerTag: "test",
    messageCount: 0,
  },
  properties: {
    contentType: "application/json",
    contentEncoding: null,
    headers: {},
    deliveryMode: 2,
    priority: undefined,
    correlationId: undefined,
    replyTo: undefined,
    expiration: undefined,
    messageId: undefined,
    timestamp: undefined,
    type: undefined,
    userId: undefined,
    appId: undefined,
    clusterId: undefined,
  },
});

const validEvent = {
  shortcode: "abc1234",
  longUrl: "https://www.google.com",
  timestamp: new Date().toISOString(),
  ip: "127.0.0.1",
  userAgent: "Mozilla/5.0",
};

// ─── startConsumer ────────────────────────────────────────
describe("startConsumer", () => {
  it("should call channel.consume on the click_events queue", async () => {
    mockChannel.consume.mockResolvedValueOnce(undefined);

    await startConsumer();

    expect(mockChannel.consume).toHaveBeenCalledWith(
      "click_events",
      expect.any(Function),
      { noAck: false },
    );
  });
});

// ─── processMessage — success ─────────────────────────────
describe("processMessage — valid event", () => {
  it("should store click event in MongoDB and ack message", async () => {
    mockClickEventCreate.mockResolvedValueOnce({});

    // Capture the consume callback
    let consumeCallback:
      | ((msg: ConsumeMessage | null) => Promise<void>)
      | null = null;
    mockChannel.consume.mockImplementationOnce(
      (_queue: string, cb: (msg: ConsumeMessage | null) => Promise<void>) => {
        consumeCallback = cb;
      },
    );

    await startConsumer();

    // Simulate a message arriving
    const msg = makeMessage(validEvent);
    await consumeCallback!(msg);

    // MongoDB should have been called with correct data
    expect(mockClickEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shortcode: "abc1234",
        longUrl: "https://www.google.com",
        ip: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      }),
    );

    // Message should be acked — removed from queue
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });
});

// ─── processMessage — bad JSON ────────────────────────────
describe("processMessage — invalid JSON", () => {
  it("should nack without requeue when message is not valid JSON", async () => {
    let consumeCallback:
      | ((msg: ConsumeMessage | null) => Promise<void>)
      | null = null;
    mockChannel.consume.mockImplementationOnce(
      (_queue: string, cb: (msg: ConsumeMessage | null) => Promise<void>) => {
        consumeCallback = cb;
      },
    );

    await startConsumer();

    const msg = makeMessage("this is not json {{{");
    await consumeCallback!(msg);

    // Should nack without requeue — bad JSON will never succeed
    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockClickEventCreate).not.toHaveBeenCalled();
  });
});

// ─── processMessage — MongoDB failure ────────────────────
describe("processMessage — MongoDB failure", () => {
  it("should nack with requeue when MongoDB write fails", async () => {
    mockClickEventCreate.mockRejectedValueOnce(new Error("MongoDB timeout"));

    let consumeCallback:
      | ((msg: ConsumeMessage | null) => Promise<void>)
      | null = null;
    mockChannel.consume.mockImplementationOnce(
      (_queue: string, cb: (msg: ConsumeMessage | null) => Promise<void>) => {
        consumeCallback = cb;
      },
    );

    await startConsumer();

    const msg = makeMessage(validEvent);
    await consumeCallback!(msg);

    // Should nack WITH requeue — MongoDB failure is temporary
    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(mockChannel.ack).not.toHaveBeenCalled();
  });
});

// ─── processMessage — missing fields ─────────────────────
describe("processMessage — missing required fields", () => {
  it("should nack without requeue when shortcode is missing", async () => {
    let consumeCallback:
      | ((msg: ConsumeMessage | null) => Promise<void>)
      | null = null;
    mockChannel.consume.mockImplementationOnce(
      (_queue: string, cb: (msg: ConsumeMessage | null) => Promise<void>) => {
        consumeCallback = cb;
      },
    );

    await startConsumer();

    const msg = makeMessage({
      longUrl: "https://google.com",
      timestamp: new Date().toISOString(),
    });
    await consumeCallback!(msg);

    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(mockClickEventCreate).not.toHaveBeenCalled();
  });
});
