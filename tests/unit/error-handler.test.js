import { expect } from "chai";
import { errorHandlerMiddleware } from "../../app/middleware.js";
import { createSilentLogger } from "../helpers/silent-logger.js";
import { SERVICE_NAME } from "../../app/config/app.conf.js";

function makeRes() {
    let statusCode = 200;
    let body;
    return {
        headersSent: false,
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            body = payload;
            return { statusCode, body };
        },
        getStatusCode: () => statusCode,
        getBody: () => body,
    };
}

function makeReq(overrides = {}) {
    return {
        id: "test-req",
        params: {},
        log: null,
        app: { locals: { rootLogger: createSilentLogger() } },
        ...overrides,
    };
}

describe("errorHandlerMiddleware", () => {
    let prevEnv;
    beforeEach(() => {
        prevEnv = process.env.NODE_ENV;
    });
    afterEach(() => {
        process.env.NODE_ENV = prevEnv;
    });

    it("maps ZodError to 400 and masks message in production", () => {
        process.env.NODE_ENV = "production";
        const err = new Error("details");
        err.name = "ZodError";
        err.issues = [{ path: ["message"], message: "Required" }];
        err.validation = err.issues;
        const req = makeReq();
        const res = makeRes();
        errorHandlerMiddleware(err, req, res, () => {});
        expect(res.getStatusCode()).to.equal(400);
        expect(res.getBody().error).to.equal("Invalid request");
    });

    it("exposes validation detail in development", () => {
        process.env.NODE_ENV = "development";
        const err = new Error("ignored");
        err.name = "ZodError";
        err.issues = [{ path: ["sessionId"], message: "Invalid" }];
        err.validation = err.issues;
        const req = makeReq();
        const res = makeRes();
        errorHandlerMiddleware(err, req, res, () => {});
        expect(res.getStatusCode()).to.equal(400);
        expect(String(res.getBody().error)).to.include("sessionId");
    });

    it("uses error.statusCode for non-validation errors", () => {
        process.env.NODE_ENV = "development";
        const err = new Error("gone");
        err.statusCode = 404;
        const req = makeReq();
        const res = makeRes();
        errorHandlerMiddleware(err, req, res, () => {});
        expect(res.getStatusCode()).to.equal(404);
        expect(res.getBody().error).to.equal("gone");
    });

    it("defaults to 500 when no status given", () => {
        process.env.NODE_ENV = "development";
        const err = new Error("boom");
        const req = makeReq();
        const res = makeRes();
        errorHandlerMiddleware(err, req, res, () => {});
        expect(res.getStatusCode()).to.equal(500);
    });

    it("logs server.error with expected fields", () => {
        process.env.NODE_ENV = "development";
        let logged;
        const log = {
            error(fields) {
                logged = fields;
            },
        };
        const req = makeReq({
            id: "rid-9",
            params: { sessionId: "11111111-2222-3333-4444-555555555555" },
            log,
        });
        const res = makeRes();
        const err = new Error("e");
        err.statusCode = 422;
        errorHandlerMiddleware(err, req, res, () => {});
        expect(logged.service).to.equal(SERVICE_NAME);
        expect(logged.event).to.equal("server.error");
        expect(logged.requestId).to.equal("rid-9");
        expect(logged.sessionId).to.equal("11111111-2222-3333-4444-555555555555");
        expect(logged.statusCode).to.equal(422);
    });

    it("does not send if headers already sent", () => {
        const err = new Error("late");
        const req = makeReq();
        const res = makeRes();
        res.headersSent = true;
        errorHandlerMiddleware(err, req, res, () => {});
        expect(res.getBody()).to.equal(undefined);
    });
});
