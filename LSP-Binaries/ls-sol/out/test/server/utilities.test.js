"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utilities_1 = require("../../src/server/utilities");
describe("path2uri()", () => {
    test("should throw an error if a non-absolute uri is passed in", () => {
        expect(() => utilities_1.path2uri("baz/qux")).toThrow();
    });
    test("should convert a Unix file path to a URI", () => {
        const uri = utilities_1.path2uri("/baz/qux");
        expect(uri).toEqual("file:///baz/qux");
    });
    test("should convert a Windows file path to a URI", () => {
        const uri = utilities_1.path2uri("C:\\baz\\qux");
        expect(uri).toEqual("file:///C:/baz/qux");
    });
    test("should encode special characters", () => {
        const uri = utilities_1.path2uri("/💩");
        expect(uri).toEqual("file:///%F0%9F%92%A9");
    });
    test("should encode unreserved special characters", () => {
        const uri = utilities_1.path2uri("/@baz");
        expect(uri).toEqual("file:///%40baz");
    });
});
describe("uri2path()", () => {
    test("should convert a Unix file URI to a file path", () => {
        const filePath = utilities_1.uri2path("file:///baz/qux");
        expect(filePath).toEqual("/baz/qux");
    });
    test("should convert a Windows file URI to a file path", () => {
        const filePath = utilities_1.uri2path("file:///c:/baz/qux");
        expect(filePath).toEqual("c:\\baz\\qux");
    });
    test("should convert a Windows file URI with uppercase drive letter to a file path", () => {
        const filePath = utilities_1.uri2path("file:///C:/baz/qux");
        expect(filePath).toEqual("C:\\baz\\qux");
    });
    test("should decode special characters", () => {
        const filePath = utilities_1.uri2path("file:///%F0%9F%92%A9");
        expect(filePath).toEqual("/💩");
    });
    test("should decode unreserved special characters", () => {
        const filePath = utilities_1.uri2path("file:///%40foo");
        expect(filePath).toEqual("/@foo");
    });
});
//# sourceMappingURL=utilities.test.js.map