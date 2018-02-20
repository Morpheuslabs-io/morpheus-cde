"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cluster = require("cluster");
const net = require("net");
const messages_1 = require("vscode-jsonrpc/lib/messages");
const vscode_languageserver_1 = require("vscode-languageserver");
const connection_1 = require("./connection");
const languageClient_1 = require("./languageClient");
const logging_1 = require("./logging");
const solidityService_1 = require("./solidityService");
/**
 * Creates a Logger prefixed with master or worker ID
 *
 * @param logger An optional logger to wrap, e.g. to write to a logfile. Defaults to STDIO
 */
function createClusterLogger(logger = new logging_1.StdioLogger()) {
    return new logging_1.PrefixedLogger(logger, cluster.isMaster ? "master" : `wrkr ${cluster.worker.id}`);
}
exports.createClusterLogger = createClusterLogger;
/**
 * Starts up a cluster of worker processes that listen on the same TCP socket.
 * Crashing workers are restarted automatically.
 *
 * @param options
 * @param createLangHandler Factory function that is called for each new connection
 */
function serve(options, createLangHandler = (remoteClient) => new solidityService_1.SolidityService(remoteClient)) {
    const logger = options.logger || createClusterLogger();
    if (options.clusterSize > 1 && cluster.isMaster) {
        logger.log(`Spawning ${options.clusterSize} workers`);
        cluster.on("online", worker => {
            logger.log(`Worker ${worker.id} (PID ${worker.process.pid}) online`);
        });
        cluster.on("exit", (worker, code, signal) => {
            logger.error(`Worker ${worker.id} (PID ${worker.process.pid}) exited from signal ${signal} with code ${code}, restarting`);
            cluster.fork();
        });
        for (let i = 0; i < options.clusterSize; ++i) {
            cluster.fork();
        }
    }
    else {
        let counter = 1;
        const server = net.createServer(socket => {
            const id = counter++;
            logger.log(`Connection ${id} accepted`);
            const messageEmitter = new connection_1.MessageEmitter(new vscode_languageserver_1.StreamMessageReader(socket), options);
            const messageWriter = new connection_1.MessageWriter(new vscode_languageserver_1.StreamMessageWriter(socket), options);
            const remoteClient = new languageClient_1.RemoteLanguageClient(messageEmitter, messageWriter);
            // Add exit notification handler to close the socket on exit
            messageEmitter.on("message", message => {
                if (messages_1.isNotificationMessage(message) && message.method === "exit") {
                    socket.end();
                    socket.destroy();
                    logger.log(`Connection ${id} closed (exit notification)`);
                }
            });
            connection_1.registerLanguageHandler(messageEmitter, messageWriter, createLangHandler(remoteClient), options);
        });
        server.listen(options.lspPort, () => {
            logger.info(`Listening for incoming LSP connections on ${options.lspPort}`);
        });
    }
}
exports.serve = serve;
//# sourceMappingURL=server.js.map