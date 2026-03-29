import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { openDB, saveToQueue, getQueueCount, processQueue } from "../queue.js";

describe("queue", () => {
    it("exports all expected functions", () => {
        expect(typeof openDB).toBe("function");
        expect(typeof saveToQueue).toBe("function");
        expect(typeof getQueueCount).toBe("function");
        expect(typeof processQueue).toBe("function");
    });

    it("openDB returns a database", async () => {
        const db = await openDB();
        expect(db).toBeTruthy();
        expect(db.objectStoreNames).toContain("recordings");
        db.close();
    });

    it("getQueueCount returns a number", async () => {
        const count = await getQueueCount();
        expect(typeof count).toBe("number");
    });
});
