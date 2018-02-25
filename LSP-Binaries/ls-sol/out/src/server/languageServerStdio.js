"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const messages_1 = require("vscode-jsonrpc/lib/messages");
const vscode_languageserver_1 = require("vscode-languageserver");
const connection_1 = require("./connection");
const languageClient_1 = require("./languageClient");
const logging_1 = require("./logging");
const solidityService_1 = require("./solidityService");
const program = require("commander");
const packageJson = require("../package.json");
program
    .version(packageJson.version)
    .option("-l, --logfile [file]", "log to this file")
    .parse(process.argv);
const logger = program.logfile ? new logging_1.FileLogger(program.logfile) : new logging_1.StderrLogger();
const options = {
    logger
};
const messageEmitter = new connection_1.MessageEmitter(new vscode_languageserver_1.StreamMessageReader(process.stdin), options);
const messageWriter = new connection_1.MessageWriter(new vscode_languageserver_1.StreamMessageWriter(process.stdout), options);
const remoteClient = new languageClient_1.RemoteLanguageClient(messageEmitter, messageWriter);
const service = new solidityService_1.SolidityService(remoteClient, options);
// Add an exit notification handler to kill the process
messageEmitter.on("message", message => {
    if (messages_1.isNotificationMessage(message) && message.method === "exit") {
        logger.log(`Exit notification`);
        process.exit(0);
    }
});
connection_1.registerLanguageHandler(messageEmitter, messageWriter, service, options);
//# sourceMappingURL=languageServerStdio.js.map