import { expect } from "chai";
import request from "supertest";
import { createRouteIntegrationApp } from "../helpers/test-app.factory.js";

describe("Express app wiring (integration)", () => {
    it("GET /health/live responds without database", async () => {
        const app = await createRouteIntegrationApp();
        const res = await request(app).get("/health/live").expect(200);
        expect(res.body).to.deep.equal({ status: "live" });
    });
});
