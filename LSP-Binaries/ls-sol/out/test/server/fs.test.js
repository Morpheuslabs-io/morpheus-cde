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
const path = require("path");
const fs = require("mz/fs");
const rimraf = require("rimraf");
const temp = require("temp");
const fs_1 = require("../../src/server/fs");
const utilities_1 = require("../../src/server/utilities");
describe("fs.ts", () => {
    describe("LocalFileSystem", () => {
        let temporaryDir;
        let fileSystem;
        let rootUri;
        beforeAll(() => __awaiter(this, void 0, void 0, function* () {
            temporaryDir = yield new Promise((resolve, reject) => {
                temp.mkdir("local-fs", (err, dirPath) => err ? reject(err) : resolve(dirPath));
            });
            // global packages contains a package
            const globalPackagesDir = path.join(temporaryDir, "node_modules");
            yield fs.mkdir(globalPackagesDir);
            const somePackageDir = path.join(globalPackagesDir, "some_package");
            yield fs.mkdir(somePackageDir);
            yield fs.mkdir(path.join(somePackageDir, "src"));
            yield fs.writeFile(path.join(somePackageDir, "src", "function.ts"), "foo");
            // the project dir
            const projectDir = path.join(temporaryDir, "project");
            rootUri = utilities_1.path2uri(projectDir) + "/";
            yield fs.mkdir(projectDir);
            yield fs.mkdir(path.join(projectDir, "foo"));
            yield fs.mkdir(path.join(projectDir, "@types"));
            yield fs.mkdir(path.join(projectDir, "@types", "diff"));
            yield fs.mkdir(path.join(projectDir, "node_modules"));
            yield fs.writeFile(path.join(projectDir, "tweedledee"), "hi");
            yield fs.writeFile(path.join(projectDir, "tweedledum"), "bye");
            yield fs.writeFile(path.join(projectDir, "foo", "bar.ts"), "baz");
            yield fs.writeFile(path.join(projectDir, "@types", "diff", "index.d.ts"), "baz");
            // global package is symlinked into project using npm link
            yield fs.symlink(somePackageDir, path.join(projectDir, "node_modules", "some_package"), "junction");
            fileSystem = new fs_1.LocalFileSystem(rootUri);
        }));
        afterAll(() => __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve, reject) => {
                rimraf(temporaryDir, (err) => err ? reject(err) : resolve());
            });
        }));
        describe("getWorkspaceFiles()", () => {
            test("should return all files in the workspace", () => __awaiter(this, void 0, void 0, function* () {
                const files = yield fileSystem.getWorkspaceFiles().toArray().toPromise();
                expect(files).toEqual([
                    rootUri + "tweedledee",
                    rootUri + "tweedledum",
                    rootUri + "foo/bar.ts",
                    rootUri + "%40types/diff/index.d.ts",
                    rootUri + "node_modules/some_package/src/function.ts"
                ]);
            }));
            test("should return all files under specific root", () => __awaiter(this, void 0, void 0, function* () {
                const files = yield fileSystem.getWorkspaceFiles(rootUri + "foo").toArray().toPromise();
                expect(files).toEqual([
                    rootUri + "foo/bar.ts"
                ]);
            }));
        });
        describe("getTextDocumentContent()", () => {
            test("should read files denoted by absolute URI", () => __awaiter(this, void 0, void 0, function* () {
                const content = yield fileSystem.getTextDocumentContent(rootUri + "tweedledee").toPromise();
                expect(content).toBe("hi");
            }));
        });
    });
});
//# sourceMappingURL=fs.test.js.map