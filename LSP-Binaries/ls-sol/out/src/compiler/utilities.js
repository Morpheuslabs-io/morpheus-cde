"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
exports.emptyArray = [];
function packageIdIsEqual(a, b) {
    return a === b || a && b && a.name === b.name && a.subModuleName === b.subModuleName && a.version === b.version;
}
exports.packageIdIsEqual = packageIdIsEqual;
/** Calls `callback` on `directory` and every ancestor directory it has, returning the first defined result. */
function forEachAncestorDirectory(directory, callback) {
    while (true) {
        const result = callback(directory);
        if (result !== undefined) {
            return result;
        }
        const parentPath = core_1.getDirectoryPath(directory);
        if (parentPath === directory) {
            return undefined;
        }
        directory = parentPath;
    }
}
exports.forEachAncestorDirectory = forEachAncestorDirectory;
function setResolvedModule(sourceFile, moduleNameText, resolvedModule) {
    if (!sourceFile.resolvedModules) {
        sourceFile.resolvedModules = core_1.createMap();
    }
    sourceFile.resolvedModules.set(moduleNameText, resolvedModule);
}
exports.setResolvedModule = setResolvedModule;
function compareDataObjects(dst, src) {
    if (!dst || !src || Object.keys(dst).length !== Object.keys(src).length) {
        return false;
    }
    for (const e in dst) {
        if (typeof dst[e] === "object") {
            if (!compareDataObjects(dst[e], src[e])) {
                return false;
            }
        }
        else if (typeof dst[e] !== "function") {
            if (dst[e] !== src[e]) {
                return false;
            }
        }
    }
    return true;
}
exports.compareDataObjects = compareDataObjects;
//# sourceMappingURL=utilities.js.map