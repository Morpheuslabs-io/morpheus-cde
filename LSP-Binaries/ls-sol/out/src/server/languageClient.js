"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("@reactivex/rxjs");
const messages_1 = require("vscode-jsonrpc/lib/messages");
/**
 * Provides an interface to call methods on the remote client.
 * Methods are named after the camelCase version of the LSP method name
 */
class RemoteLanguageClient {
    /**
     * @param input MessageEmitter to listen on for responses
     * @param output MessageWriter to write requests/notifications to
     */
    constructor(input, output) {
        this.input = input;
        this.output = output;
        /** The next request ID to use */
        this.idCounter = 1;
    }
    /**
     * Sends a Request
     *
     * @param method The method to call
     * @param params The params to pass to the method
     * @return Emits the value of the result field or the error
     */
    request(method, params) {
        return new rxjs_1.Observable(subscriber => {
            // Generate a request ID
            const id = this.idCounter++;
            const message = { jsonrpc: "2.0", method, id, params, meta: {} };
            // Send request
            this.output.write(message);
            let receivedResponse = false;
            // Subscribe to message events
            const messageSub = rxjs_1.Observable.fromEvent(this.input, "message")
                .filter(msg => messages_1.isResponseMessage(msg) && msg.id === id)
                .take(1)
                .map((msg) => {
                receivedResponse = true;
                if (msg.error) {
                    throw Object.assign(new Error(msg.error.message), msg.error);
                }
                return msg.result;
            })
                .subscribe(subscriber);
            // Handler for unsubscribe()
            return () => {
                // Unsubscribe message event subscription (removes listener)
                messageSub.unsubscribe();
                if (!receivedResponse) {
                    // Send LSP $/cancelRequest to client
                    this.notify("$/cancelRequest", { id });
                }
            };
        });
    }
    /**
     * The content request is sent from the server to the client to request the current content of
     * any text document. This allows language servers to operate without accessing the file system
     * directly.
     */
    textDocumentXcontent(params) {
        return this.request("textDocument/xcontent", params);
    }
    /**
     * The files request is sent from the server to the client to request a list of all files in the
     * workspace or inside the directory of the `base` parameter, if given.
     */
    workspaceXfiles(params) {
        return this.request("workspace/xfiles", params);
    }
    /**
     * Sends a Notification
     *
     * @param method The method to notify
     * @param params The params to pass to the method
     */
    notify(method, params) {
        const message = { jsonrpc: "2.0", method, params };
        this.output.write(message);
    }
    /**
     * The log message notification is sent from the server to the client to ask
     * the client to log a particular message.
     */
    windowLogMessage(params) {
        this.notify("window/logMessage", params);
    }
    /**
     * Diagnostics are sent from the server to the client to notify the user of errors/warnings
     * in a source file
     * @param params The diagnostics to send to the client
     */
    textDocumentPublishDiagnostics(params) {
        this.notify("textDocument/publishDiagnostics", params);
    }
}
exports.RemoteLanguageClient = RemoteLanguageClient;
//# sourceMappingURL=languageClient.js.map