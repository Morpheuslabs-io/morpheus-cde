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
const rxjs_1 = require("@reactivex/rxjs");
const fast_json_patch_1 = require("fast-json-patch");
const _ = require("lodash");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const messages_1 = require("vscode-jsonrpc/lib/messages");
const logging_1 = require("./logging");
/**
 * Takes a NodeJS ReadableStream and emits parsed messages received on the stream.
 * In opposite to StreamMessageReader, supports multiple listeners and is compatible with Observables
 */
class MessageEmitter extends events_1.EventEmitter {
    constructor(reader, options = {}) {
        super();
        // Forward events
        reader.listen(msg => {
            this.emit("message", msg);
        });
        reader.onError(err => {
            this.emit("error", err);
        });
        reader.onClose(() => {
            this.emit("close");
        });
        this.setMaxListeners(Infinity);
        // Register message listener to log messages if configured
        if (options.logMessages && options.logger) {
            const logger = options.logger;
            this.on("message", message => {
                logger.log("-->", message);
            });
        }
    }
    /* istanbul ignore next */
    on(event, listener) {
        return super.on(event, listener);
    }
    /* istanbul ignore next */
    once(event, listener) {
        return super.on(event, listener);
    }
}
exports.MessageEmitter = MessageEmitter;
/**
 * Wraps vscode-jsonrpcs StreamMessageWriter to support logging messages,
 * decouple our code from the vscode-jsonrpc module and provide a more
 * consistent event API
 */
class MessageWriter {
    /**
     * @param vscodeWriter The writer to write to
     * @param options
     */
    constructor(vscodeWriter, options = {}) {
        this.vscodeWriter = vscodeWriter;
        this.logger = options.logger || new logging_1.NoopLogger();
        this.logMessages = !!options.logMessages;
    }
    /**
     * Writes a JSON RPC message to the output stream.
     * Logs it if configured
     *
     * @param message A complete JSON RPC message object
     */
    write(message) {
        if (this.logMessages) {
            this.logger.log("<--", message);
        }
        this.vscodeWriter.write(message);
    }
}
exports.MessageWriter = MessageWriter;
/**
 * Returns true if the passed argument is an object with a `.then()` method
 */
function isPromiseLike(candidate) {
    return typeof candidate === "object" && candidate !== null && typeof candidate.then === "function";
}
/**
 * Returns true if the passed argument is an object with a `[Symbol.observable]` method
 */
function isObservable(candidate) {
    return typeof candidate === "object" && candidate !== null && typeof candidate[rxjs_1.Symbol.observable] === "function";
}
/**
 * Registers all method implementations of a LanguageHandler on a connection
 *
 * @param messageEmitter MessageEmitter to listen on
 * @param messageWriter MessageWriter to write to
 * @param handler Solidity object that contains methods for all methods to be handled
 */
function registerLanguageHandler(messageEmitter, messageWriter, handler, options = {}) {
    const logger = options.logger || new logging_1.NoopLogger();
    /** Tracks Subscriptions for results to unsubscribe them on $/cancelRequest */
    const subscriptions = new Map();
    /**
     * Whether the handler is in an initialized state.
     * `initialize` sets this to true, `shutdown` to false.
     * Used to determine whether a manual `shutdown` call is needed on error/close
     */
    let initialized = false;
    messageEmitter.on("message", (message) => __awaiter(this, void 0, void 0, function* () {
        // Ignore responses
        if (messages_1.isResponseMessage(message)) {
            return;
        }
        if (!messages_1.isRequestMessage(message) && !messages_1.isNotificationMessage(message)) {
            logger.error("Received invalid message:", message);
            return;
        }
        switch (message.method) {
            case "initialize":
                initialized = true;
                break;
            case "shutdown":
                initialized = false;
                break;
            case "exit":
                // Ignore exit notification, it's not the responsibility of the SolidityService to handle it,
                // but the TCP / STDIO server which needs to close the socket or kill the process
                for (const subscription of subscriptions.values()) {
                    subscription.unsubscribe();
                }
                return;
            case "$/cancelRequest":
                // Cancel another request by unsubscribing from the Observable
                const subscription = subscriptions.get(message.params.id);
                if (!subscription) {
                    logger.warn(`$/cancelRequest for unknown request ID ${message.params.id}`);
                    return;
                }
                subscription.unsubscribe();
                subscriptions.delete(message.params.id);
                messageWriter.write({
                    jsonrpc: "2.0",
                    id: message.params.id,
                    error: {
                        message: "Request cancelled",
                        code: vscode_jsonrpc_1.ErrorCodes.RequestCancelled
                    }
                });
                return;
        }
        const method = _.camelCase(message.method);
        if (typeof handler[method] !== "function") {
            // Method not implemented
            if (messages_1.isRequestMessage(message)) {
                messageWriter.write({
                    jsonrpc: "2.0",
                    id: message.id,
                    error: {
                        code: vscode_jsonrpc_1.ErrorCodes.MethodNotFound,
                        message: `Method ${method} not implemented`
                    }
                });
            }
            else {
                logger.warn(`Method ${method} not implemented`);
            }
            return;
        }
        // Call handler method with params and span
        let observable;
        try {
            // Convert return value to Observable
            const returnValue = handler[method](message.params);
            if (isObservable(returnValue)) {
                observable = returnValue;
            }
            else if (isPromiseLike(returnValue)) {
                observable = rxjs_1.Observable.from(returnValue);
            }
            else {
                observable = rxjs_1.Observable.of(returnValue);
            }
        }
        catch (err) {
            observable = rxjs_1.Observable.throw(err);
        }
        if (messages_1.isRequestMessage(message)) {
            const subscription = observable
                .reduce(fast_json_patch_1.applyReducer, null)
                .finally(() => {
                // Delete subscription from Map
                // Make sure to not run this before subscription.set() was called
                // (in case the Observable is synchronous)
                process.nextTick(() => {
                    subscriptions.delete(message.id);
                });
            })
                .subscribe(result => {
                // Send final result
                messageWriter.write({
                    jsonrpc: "2.0",
                    id: message.id,
                    result
                });
            }, err => {
                // Log error
                logger.error(`Handler for ${message.method} failed:`, err, "\nMessage:", message);
                // Send error response
                messageWriter.write({
                    jsonrpc: "2.0",
                    id: message.id,
                    error: {
                        message: err.message + "",
                        code: typeof err.code === "number" ? err.code : vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode,
                        data: _.omit(err, ["message", "code"])
                    }
                });
            });
            // Save subscription for $/cancelRequest
            subscriptions.set(message.id, subscription);
        }
        else {
            // For notifications, still subscribe and log potential error
            observable.subscribe(undefined, err => {
                logger.error(`Handle ${method}:`, err);
            });
        }
    }));
    // On stream close, shutdown handler if it was initialized
    messageEmitter.once("close", () => {
        // Cancel all outstanding requests
        for (const subscription of subscriptions.values()) {
            subscription.unsubscribe();
        }
        if (initialized) {
            initialized = false;
            logger.error("Stream was closed without shutdown notification");
            handler.shutdown();
        }
    });
    // On stream error, shutdown handler if it was initialized
    messageEmitter.once("error", err => {
        // Cancel all outstanding requests
        for (const subscription of subscriptions.values()) {
            subscription.unsubscribe();
        }
        if (initialized) {
            initialized = false;
            logger.error("Stream:", err);
            handler.shutdown();
        }
    });
}
exports.registerLanguageHandler = registerLanguageHandler;
//# sourceMappingURL=connection.js.map