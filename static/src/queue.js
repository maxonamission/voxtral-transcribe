// Voxtral Transcribe — Copyright (c) 2026 Max Kloosterman
// Licensed under GPL-3.0 — see LICENSE for details
// https://github.com/maxonamission/voxtral-transcribe

/**
 * IndexedDB offline recording queue.
 * Stores audio blobs when the server is unreachable and processes
 * them when connectivity is restored.
 */

const DB_NAME = "voxtral-queue";
const STORE_NAME = "recordings";

/**
 * Open (or create) the IndexedDB database.
 */
export function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME, { autoIncrement: true });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/**
 * Save a recording blob to the queue.
 */
export async function saveToQueue(blob) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(blob);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
}

/**
 * Count items in the queue.
 */
export async function getQueueCount() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((res) => {
        const req = store.count();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(0);
    });
}

/**
 * Process all queued recordings by sending them to the server.
 * Returns { processed: number, total: number }.
 *
 * @param {function} onTranscribed — callback for each successfully transcribed text
 */
export async function processQueue(onTranscribed) {
    const count = await getQueueCount();
    if (count === 0) return { processed: 0, total: 0 };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const allKeys = await new Promise((res) => {
        const req = store.getAllKeys();
        req.onsuccess = () => res(req.result);
        req.onerror = () => res([]);
    });

    let processed = 0;
    for (const key of allKeys) {
        const getTx = db.transaction(STORE_NAME, "readonly");
        const blob = await new Promise((res) => {
            const req = getTx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => res(req.result);
            req.onerror = () => res(null);
        });
        if (!blob) continue;
        try {
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
            if (!resp.ok) {
                console.warn(`Queue item ${key}: server returned ${resp.status}, skipping`);
                continue;
            }
            const data = await resp.json();
            if (data.text && onTranscribed) onTranscribed(data.text + " ");
            // Delete successfully processed item
            const delTx = db.transaction(STORE_NAME, "readwrite");
            delTx.objectStore(STORE_NAME).delete(key);
            await new Promise((res) => { delTx.oncomplete = res; });
            processed++;
        } catch (err) {
            console.warn("Queue processing failed (offline?):", err.message);
            break;
        }
    }
    return { processed, total: count };
}
