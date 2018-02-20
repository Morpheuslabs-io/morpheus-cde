"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logging_1 = require("./logging");
const server_1 = require("./server");
const solidityService_1 = require("./solidityService");
const program = require("commander");
const numCPUs = require("os").cpus().length;
const packageJson = require("../package.json");
const defaultLspPort = 2089;
program
    .version(packageJson.version)
    .option("-p, --port [port]', 'specifies LSP port to use (" + defaultLspPort + ")", parseInt)
    .option("-c, --cluster [num]", "number of concurrent cluster workers (defaults to number of CPUs, " + numCPUs + ")", parseInt)
    .option("-l, --logfile [file]", "log to this file")
    .parse(process.argv);
const options = {
    clusterSize: program.cluster || numCPUs,
    lspPort: program.port || defaultLspPort,
    logger: program.logfile ? new logging_1.FileLogger(program.logfile) : new logging_1.StdioLogger(),
};
server_1.serve(options, client => new solidityService_1.SolidityService(client, options));
//# sourceMappingURL=languageServer.js.map