/**
 * chunkedUploader.js
 * High-performance, low-memory file slicing and uploading utility.
 * Distributes large PDFs into 5MB chunks and streams them to the backend,
 * bypassing total-file base64 conversion and browser memory locks.
 */

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_CONCURRENT = 3;

// Generates a simple UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const uploadFileInChunks = async (file, onProgress) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileUUID = generateUUID();

    let uploadedChunks = 0;

    // Concurrency queue
    const queue = [];
    const activeUploads = new Set();
    let failed = false;

    // Execute single chunk upload with Exponential Backoff
    const uploadChunk = async (chunkIndex) => {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('fileUUID', fileUUID);
        formData.append('chunkIndex', chunkIndex);
        formData.append('chunk', chunk); // The raw binary Blob

        let retries = 0;
        const maxRetries = 5;

        while (retries < maxRetries && !failed) {
            try {
                const res = await fetch(api(`/api/upload/pdf-chunk`), {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                // Success
                uploadedChunks++;
                if (onProgress) {
                    onProgress(Math.round((uploadedChunks / totalChunks) * 90)); // Max 90% during chunks
                }
                return;
            } catch (err) {
                retries++;
                console.warn(`Chunk ${chunkIndex} failed (Attempt ${retries}/${maxRetries}):`, err);
                if (retries >= maxRetries) {
                    failed = true;
                    throw new Error(`Upload failed after 5 retries for chunk ${chunkIndex}`);
                }
                // Exponential Backoff: 1s, 2s, 4s, 8s...
                await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
            }
        }
    };

    return new Promise((resolve, reject) => {
        const enqueueNext = () => {
            if (failed) return reject(new Error("Upload aborted due to chunk failure."));
            if (queue.length === 0 && activeUploads.size === 0) {
                // All chunks sent, run finalize
                finalizeUpload();
                return;
            }

            while (activeUploads.size < MAX_CONCURRENT && queue.length > 0 && !failed) {
                const nextChunkIndex = queue.shift();
                const promise = uploadChunk(nextChunkIndex);
                activeUploads.add(promise);

                promise.then(() => {
                    activeUploads.delete(promise);
                    enqueueNext(); // Recursive dequeue
                }).catch(err => {
                    failed = true;
                    reject(err);
                });
            }
        };

        const finalizeUpload = async () => {
            if (onProgress) onProgress(95); // Finalizing
            try {
                const res = await fetch(api(`/api/upload/multipart-finalize`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileUUID,
                        totalChunks,
                        contentType: file.type || 'application/pdf'
                    })
                });

                if (!res.ok) throw new Error(`Finalize failed: ${res.status}`);

                const data = await res.json();
                if (onProgress) onProgress(100); // 100% Complete
                resolve(data.url); // Return the final Cloud URL
            } catch (err) {
                reject(new Error("Failed to finalize upload: " + err.message));
            }
        };

        // Populate initial queue
        for (let i = 0; i < totalChunks; i++) {
            queue.push(i);
        }

        // Kick off concurrency
        enqueueNext();
    });
};
