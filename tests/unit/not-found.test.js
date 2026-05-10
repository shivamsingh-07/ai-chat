import { expect } from "chai";
import { notFoundMiddleware } from "../../app/middleware.js";

describe("notFoundMiddleware", () => {
    it("returns 404 JSON with route echo", () => {
        let code;
        let payload;
        const req = { method: "GET", originalUrl: "/nope" };
        const res = {
            status(c) {
                code = c;
                return this;
            },
            json(b) {
                payload = b;
            },
        };
        notFoundMiddleware(req, res);
        expect(code).to.equal(404);
        expect(payload.statusCode).to.equal(404);
        expect(payload.error).to.equal("Not Found");
        expect(payload.message).to.include("GET:/nope");
    });
});
