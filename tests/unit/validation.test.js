import { expect } from "chai";
import { validateListMessagesParams, validateChatRequest } from "../../app/middleware.js";
import { validSessionIds, invalidSessionIds } from "../fixtures/uuids.js";

function runMiddleware(mw, req) {
    return new Promise((resolve, reject) => {
        const res = {};
        mw(req, res, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function expectZodRejection(promise) {
    try {
        await promise;
        expect.fail("expected middleware to call next(err)");
    } catch (err) {
        expect(err.name).to.equal("ZodError");
    }
}

describe("validateListMessagesParams", () => {
    for (const id of validSessionIds) {
        it(`accepts ${id}`, async () => {
            await runMiddleware(validateListMessagesParams, { params: { sessionId: id } });
        });
    }

    for (const id of invalidSessionIds) {
        it(`rejects invalid sessionId ${JSON.stringify(id)}`, async () => {
            try {
                await runMiddleware(validateListMessagesParams, { params: { sessionId: id } });
                expect.fail("expected rejection");
            } catch (err) {
                expect(err.name).to.equal("ZodError");
            }
        });
    }
});

describe("validateChatRequest", () => {
    const okId = validSessionIds[0];

    it("accepts valid params and non-empty message", async () => {
        await runMiddleware(validateChatRequest, {
            params: { sessionId: okId },
            body: { message: "hello" },
        });
    });

    it("rejects empty message", async () => {
        await expectZodRejection(
            runMiddleware(validateChatRequest, {
                params: { sessionId: okId },
                body: { message: "" },
            }),
        );
    });

    it("rejects missing message", async () => {
        await expectZodRejection(
            runMiddleware(validateChatRequest, {
                params: { sessionId: okId },
                body: {},
            }),
        );
    });

    it("rejects message over max length", async () => {
        await expectZodRejection(
            runMiddleware(validateChatRequest, {
                params: { sessionId: okId },
                body: { message: "x".repeat(100_001) },
            }),
        );
    });

    it("rejects bad sessionId even with good body", async () => {
        await expectZodRejection(
            runMiddleware(validateChatRequest, {
                params: { sessionId: "bad" },
                body: { message: "hi" },
            }),
        );
    });
});
