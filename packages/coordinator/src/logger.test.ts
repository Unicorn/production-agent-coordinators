import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConsoleLogger } from "./logger";

describe("ConsoleLogger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debug", () => {
    it("should log debug message", () => {
      const logger = new ConsoleLogger();
      logger.debug("test message");

      expect(consoleDebugSpy).toHaveBeenCalledWith("test message");
    });

    it("should log debug message with metadata", () => {
      const logger = new ConsoleLogger();
      const meta = { key: "value" };
      logger.debug("test message", meta);

      expect(consoleDebugSpy).toHaveBeenCalledWith("test message", meta);
    });

    it("should include prefix in debug message", () => {
      const logger = new ConsoleLogger("APP");
      logger.debug("test message");

      expect(consoleDebugSpy).toHaveBeenCalledWith("[APP] test message");
    });
  });

  describe("info", () => {
    it("should log info message", () => {
      const logger = new ConsoleLogger();
      logger.info("test message");

      expect(consoleInfoSpy).toHaveBeenCalledWith("test message");
    });

    it("should log info message with metadata", () => {
      const logger = new ConsoleLogger();
      const meta = { key: "value" };
      logger.info("test message", meta);

      expect(consoleInfoSpy).toHaveBeenCalledWith("test message", meta);
    });

    it("should include prefix in info message", () => {
      const logger = new ConsoleLogger("APP");
      logger.info("test message");

      expect(consoleInfoSpy).toHaveBeenCalledWith("[APP] test message");
    });
  });

  describe("warn", () => {
    it("should log warn message", () => {
      const logger = new ConsoleLogger();
      logger.warn("test message");

      expect(consoleWarnSpy).toHaveBeenCalledWith("test message");
    });

    it("should log warn message with metadata", () => {
      const logger = new ConsoleLogger();
      const meta = { key: "value" };
      logger.warn("test message", meta);

      expect(consoleWarnSpy).toHaveBeenCalledWith("test message", meta);
    });

    it("should include prefix in warn message", () => {
      const logger = new ConsoleLogger("APP");
      logger.warn("test message");

      expect(consoleWarnSpy).toHaveBeenCalledWith("[APP] test message");
    });
  });

  describe("error", () => {
    it("should log error message", () => {
      const logger = new ConsoleLogger();
      logger.error("test message");

      expect(consoleErrorSpy).toHaveBeenCalledWith("test message");
    });

    it("should log error message with Error object", () => {
      const logger = new ConsoleLogger();
      const error = new Error("test error");
      logger.error("test message", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith("test message", {
        error: "test error",
        stack: error.stack,
      });
    });

    it("should log error message with metadata", () => {
      const logger = new ConsoleLogger();
      const meta = { key: "value" };
      logger.error("test message", undefined, meta);

      expect(consoleErrorSpy).toHaveBeenCalledWith("test message", {
        error: undefined,
        key: "value",
        stack: undefined,
      });
    });

    it("should log error message with both Error and metadata", () => {
      const logger = new ConsoleLogger();
      const error = new Error("test error");
      const meta = { key: "value" };
      logger.error("test message", error, meta);

      expect(consoleErrorSpy).toHaveBeenCalledWith("test message", {
        error: "test error",
        stack: error.stack,
        key: "value",
      });
    });

    it("should include prefix in error message", () => {
      const logger = new ConsoleLogger("APP");
      logger.error("test message");

      expect(consoleErrorSpy).toHaveBeenCalledWith("[APP] test message");
    });
  });

  describe("prefix handling", () => {
    it("should create logger without prefix", () => {
      const logger = new ConsoleLogger();
      logger.info("test");

      expect(consoleInfoSpy).toHaveBeenCalledWith("test");
    });

    it("should create logger with empty string prefix", () => {
      const logger = new ConsoleLogger("");
      logger.info("test");

      expect(consoleInfoSpy).toHaveBeenCalledWith("test");
    });

    it("should create logger with custom prefix", () => {
      const logger = new ConsoleLogger("CUSTOM");
      logger.info("test");

      expect(consoleInfoSpy).toHaveBeenCalledWith("[CUSTOM] test");
    });
  });
});
