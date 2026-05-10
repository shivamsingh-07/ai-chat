import { expect } from "chai";
import { createHttpError, baseLogFields } from "../../app/utils/http.util.js";
import { now, toIsoString } from "../../app/utils/time.util.js";
import { sleep } from "../../app/utils/retry.util.js";
import { SERVICE_NAME } from "../../app/config/app.conf.js";

describe("Http.util", () => {
    it("createHttpError attaches statusCode", () => {
        const err = createHttpError(418, "short");
        expect(err.statusCode).to.equal(418);
        expect(err.message).to.equal("short");
    });

    it("baseLogFields merges request context and extras", () => {
        const req = {
            id: "req-1",
            params: { sessionId: "11111111-2222-3333-4444-555555555555" },
        };
        const fields = baseLogFields(req, { event: "test.event" });
        expect(fields.service).to.equal(SERVICE_NAME);
        expect(fields.requestId).to.equal("req-1");
        expect(fields.sessionId).to.equal("11111111-2222-3333-4444-555555555555");
        expect(fields.event).to.equal("test.event");
    });

    it("baseLogFields uses null sessionId when absent", () => {
        const req = { id: "r2", params: {} };
        expect(baseLogFields(req).sessionId).to.equal(null);
    });
});

describe("Time.util", () => {
    it("now returns a Date", () => {
        expect(now()).to.be.instanceOf(Date);
    });

    it("toIsoString formats Date and date-like input", () => {
        const d = new Date("2020-01-02T03:04:05.000Z");
        expect(toIsoString(d)).to.equal("2020-01-02T03:04:05.000Z");
        expect(toIsoString("2020-01-02T03:04:05.000Z")).to.equal("2020-01-02T03:04:05.000Z");
    });
});

describe("Retry.util", () => {
    it("sleep resolves after the delay", async () => {
        const t0 = Date.now();
        await sleep(15);
        expect(Date.now() - t0).to.be.at.least(10);
    });
});
