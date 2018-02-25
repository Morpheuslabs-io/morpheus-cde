"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const stream_1 = require("stream");
const sinon = require("sinon");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const vscode_languageserver_1 = require("vscode-languageserver");
const connection_1 = require("../../src/server/connection");
const logging_1 = require("../../src/server/logging");
const solidityService_1 = require("../../src/server/solidityService");
describe("connection", () => {
    describe("registerLanguageHandler()", () => {
        test("should return MethodNotFound error when the method does not exist on handler", () => __awaiter(this, void 0, void 0, function* () {
            const handler = Object.create(solidityService_1.SolidityService.prototype);
            const emitter = new events_1.EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            connection_1.registerLanguageHandler(emitter, writer, handler);
            const params = [1, 1];
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "whatever", params });
            sinon.assert.calledOnce(writer.write);
            sinon.assert.calledWithExactly(writer.write, sinon.match({ jsonrpc: "2.0", id: 1, error: { code: vscode_jsonrpc_1.ErrorCodes.MethodNotFound } }));
        }));
        test("should ignore exit notifications", () => __awaiter(this, void 0, void 0, function* () {
            const handler = {
                exit: sinon.spy()
            };
            const emitter = new events_1.EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            connection_1.registerLanguageHandler(emitter, writer, handler);
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "exit" });
            sinon.assert.notCalled(handler.exit);
            sinon.assert.notCalled(writer.write);
        }));
        test("should ignore responses", () => __awaiter(this, void 0, void 0, function* () {
            const handler = {
                whatever: sinon.spy()
            };
            const emitter = new events_1.EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            connection_1.registerLanguageHandler(emitter, writer, handler);
            emitter.emit("message", { jsonrpc: "2.0", id: 1, method: "whatever", result: 123 });
            sinon.assert.notCalled(handler.whatever);
        }));
        test("should log invalid messages", () => __awaiter(this, void 0, void 0, function* () {
            const handler = {
                whatever: sinon.spy()
            };
            const emitter = new events_1.EventEmitter();
            const writer = {
                write: sinon.spy()
            };
            const logger = new logging_1.NoopLogger();
            sinon.stub(logger, "error");
            connection_1.registerLanguageHandler(emitter, writer, handler, { logger });
            emitter.emit("message", { jsonrpc: "2.0", id: 1 });
            sinon.assert.calledOnce(logger.error);
        }));
    });
    describe("MessageEmitter", () => {
        test("should log messages if enabled", () => __awaiter(this, void 0, void 0, function* () {
            const logger = new logging_1.NoopLogger();
            sinon.stub(logger, "log");
            const emitter = new connection_1.MessageEmitter(new vscode_languageserver_1.StreamMessageReader(new stream_1.PassThrough()), { logMessages: true, logger });
            emitter.emit("message", { jsonrpc: "2.0", method: "whatever" });
            sinon.assert.calledOnce(logger.log);
            sinon.assert.calledWith(logger.log, "-->");
        }));
        test("should not log messages if disabled", () => __awaiter(this, void 0, void 0, function* () {
            const logger = new logging_1.NoopLogger();
            sinon.stub(logger, "log");
            const emitter = new connection_1.MessageEmitter(new vscode_languageserver_1.StreamMessageReader(new stream_1.PassThrough()), { logMessages: false, logger });
            emitter.emit("message", { jsonrpc: "2.0", method: "whatever" });
            sinon.assert.notCalled(logger.log);
        }));
    });
    describe("MessageWriter", () => {
        test("should log messages if enabled", () => __awaiter(this, void 0, void 0, function* () {
            const logger = new logging_1.NoopLogger();
            sinon.stub(logger, "log");
            const writer = new connection_1.MessageWriter(new vscode_languageserver_1.StreamMessageWriter(new stream_1.PassThrough()), { logMessages: true, logger });
            writer.write({ jsonrpc: "2.0", method: "whatever" });
            sinon.assert.calledOnce(logger.log);
            sinon.assert.calledWith(logger.log, "<--");
        }));
        test("should not log messages if disabled", () => __awaiter(this, void 0, void 0, function* () {
            const logger = new logging_1.NoopLogger();
            sinon.stub(logger, "log");
            const writer = new connection_1.MessageWriter(new vscode_languageserver_1.StreamMessageWriter(new stream_1.PassThrough()), { logMessages: false, logger });
            writer.write({ jsonrpc: "2.0", method: "whatever" });
            sinon.assert.notCalled(logger.log);
        }));
    });
});
//# sourceMappingURL=connection.test.js.map