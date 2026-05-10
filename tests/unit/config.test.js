import { expect } from "chai";
import { bodyLimit, SERVICE_NAME, createRootLoggerOptions, helmetOptions } from "../../app/config/app.conf.js";

describe("app.conf", () => {
    it("exports stable constants", () => {
        expect(SERVICE_NAME).to.equal("chat-app");
        expect(bodyLimit).to.equal(1024 * 128);
    });

    describe("createRootLoggerOptions", () => {
        let prevEnv;
        beforeEach(() => {
            prevEnv = process.env.NODE_ENV;
        });
        afterEach(() => {
            process.env.NODE_ENV = prevEnv;
        });

        it("uses info level in production", () => {
            process.env.NODE_ENV = "production";
            const opts = createRootLoggerOptions();
            expect(opts.level).to.equal("info");
            const mixin = opts.mixin();
            expect(mixin.service).to.equal(SERVICE_NAME);
            expect(mixin.sessionId).to.equal(null);
        });

        it("uses debug level outside production", () => {
            process.env.NODE_ENV = "development";
            expect(createRootLoggerOptions().level).to.equal("debug");
        });
    });

    it("helmetOptions sets CSP connectSrc to self", () => {
        expect(helmetOptions.contentSecurityPolicy).to.be.an("object");
        expect(helmetOptions.contentSecurityPolicy.directives.connectSrc).to.deep.equal(["'self'"]);
        expect(helmetOptions.crossOriginEmbedderPolicy).to.equal(false);
    });
});
