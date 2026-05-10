import { expect } from "chai";
import { createHttpPipelineTestApp, createRequestIdOnlyApp, request } from "../helpers/http-pipeline-app.js";

describe("HTTP pipeline (integration)", () => {
    it("propagates x-request-id", async () => {
        const app = createHttpPipelineTestApp();
        const res = await request(app).get("/whoami").set("x-request-id", "abc-123").expect(200);
        expect(res.body.id).to.equal("abc-123");
    });

    it("generates request id when header missing", async () => {
        const app = createHttpPipelineTestApp();
        const res = await request(app).get("/whoami").expect(200);
        expect(res.body.id).to.be.a("string");
        expect(res.body.id.length).to.be.greaterThan(8);
    });

    it("normalizes trailing slash on /api paths", async () => {
        const app = createHttpPipelineTestApp();
        await request(app).get("/api/sessions/").expect(200);
    });

    it("rejects empty JSON body with application/json", async () => {
        const app = createHttpPipelineTestApp();
        const res = await request(app)
            .post("/api/echo")
            .set("Content-Type", "application/json")
            .set("Content-Length", "0")
            .expect(400);
        expect(res.body.code).to.equal("FST_ERR_CTP_EMPTY_JSON_BODY");
    });

    it("parses JSON body for POST", async () => {
        const app = createHttpPipelineTestApp();
        const res = await request(app).post("/api/echo").send({ hello: "world" }).expect(200);
        expect(res.body).to.deep.equal({ hello: "world" });
    });

    it("error handler catches malformed JSON (400)", async () => {
        const app = createHttpPipelineTestApp();
        const res = await request(app)
            .post("/api/echo")
            .set("Content-Type", "application/json")
            .send("{ not json")
            .expect(400);
        expect(res.body.error).to.be.a("string");
    });
});

describe("requestIdMiddleware in isolation", () => {
    it("trims x-request-id", async () => {
        const app = createRequestIdOnlyApp();
        const res = await request(app).get("/").set("x-request-id", "  trim-me  ").expect(200);
        expect(res.text).to.equal("trim-me");
    });
});
