import { expect } from "chai";
import request from "supertest";
import { createRouteIntegrationApp } from "../helpers/test-app.factory.js";

describe("Express app wiring (integration)", () => {
    it("GET /metrics exposes Prometheus text format", async () => {
        const app = await createRouteIntegrationApp();
        const res = await request(app).get("/metrics").expect(200);
        expect(res.headers["content-type"]).to.match(/text\/plain/);
        expect(res.text).to.include("http_request_duration_seconds");
        expect(res.text).to.include("process_cpu_user_seconds_total");
    });

    it("GET /health/live responds without database", async () => {
        const app = await createRouteIntegrationApp();
        const res = await request(app).get("/health/live").expect(200);
        expect(res.body).to.deep.equal({ status: "live" });
    });
});
