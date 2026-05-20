package io.github.maxonamission.voxtral.keyboard.model

import android.content.Context
import io.github.maxonamission.voxtral.keyboard.core.ModelManifest
import io.github.maxonamission.voxtral.keyboard.core.ModelStatus
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.RandomAccessFile
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.io.path.deleteIfExists

class ModelDownloader(
    context: Context,
    private val storage: ModelStorage = ModelStorage(context),
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build(),
) {

    /**
     * Downloads [manifest] to local storage with resume support, then verifies
     * the SHA256 against [ModelManifest.sha256]. Emits status updates as a Flow.
     *
     * Cancellation is cooperative — collecting in a cancellable scope (e.g. a
     * lifecycle-scoped CoroutineScope) interrupts the download cleanly.
     */
    fun download(manifest: ModelManifest): Flow<ModelStatus> = flow {
        val final = storage.finalFile(manifest)
        val partial = storage.partialFile(manifest)

        if (storage.isPresent(manifest)) {
            emit(ModelStatus.Ready)
            return@flow
        }

        if (storage.freeBytes() < manifest.sizeBytes * 2) {
            emit(ModelStatus.Failed("Onvoldoende vrije ruimte (heb minstens ${manifest.sizeBytes * 2 / 1_000_000} MB nodig)"))
            return@flow
        }

        val resumeFrom = if (partial.exists()) partial.length() else 0L
        emit(
            ModelStatus.Downloading(
                bytesDownloaded = resumeFrom,
                totalBytes = manifest.sizeBytes,
                bytesPerSecond = 0,
            ),
        )

        val request = Request.Builder()
            .url(manifest.url)
            .apply { if (resumeFrom > 0) header("Range", "bytes=$resumeFrom-") }
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    emit(ModelStatus.Failed("Download mislukte (HTTP ${response.code})"))
                    return@flow
                }
                val body = response.body
                    ?: return@flow emit(ModelStatus.Failed("Lege response van server"))

                // Server returned 200 instead of 206 → ignored our Range header.
                // Restart the partial file from byte 0.
                val effectiveResumeFrom = if (resumeFrom > 0 && response.code == 200) {
                    partial.delete()
                    0L
                } else {
                    resumeFrom
                }

                RandomAccessFile(partial, "rw").use { out ->
                    out.seek(effectiveResumeFrom)
                    val buffer = ByteArray(64 * 1024)
                    val source = body.byteStream()
                    var totalRead = effectiveResumeFrom
                    var lastReport = System.nanoTime()
                    var bytesSinceReport = 0L

                    while (true) {
                        val read = source.read(buffer)
                        if (read <= 0) break
                        out.write(buffer, 0, read)
                        totalRead += read
                        bytesSinceReport += read

                        val now = System.nanoTime()
                        val elapsedNs = now - lastReport
                        if (elapsedNs >= 250_000_000L) { // every 250 ms
                            val bps = (bytesSinceReport * 1_000_000_000L) / elapsedNs
                            emit(
                                ModelStatus.Downloading(
                                    bytesDownloaded = totalRead,
                                    totalBytes = manifest.sizeBytes,
                                    bytesPerSecond = bps,
                                ),
                            )
                            lastReport = now
                            bytesSinceReport = 0L
                        }
                    }
                }
            }
        } catch (t: Throwable) {
            emit(ModelStatus.Failed("Downloadfout: ${t.message ?: t::class.simpleName}"))
            return@flow
        }

        emit(ModelStatus.Verifying)
        val actualHash = sha256Of(partial)
        val expected = manifest.sha256.lowercase(Locale.ROOT)
        if (actualHash != expected) {
            partial.toPath().deleteIfExists()
            emit(ModelStatus.Failed("SHA256-mismatch (verwacht $expected, kreeg $actualHash)"))
            return@flow
        }
        if (!partial.renameTo(final)) {
            emit(ModelStatus.Failed("Kon model niet hernoemen naar definitief pad"))
            return@flow
        }
        emit(ModelStatus.Ready)
    }.flowOn(Dispatchers.IO)

    private fun sha256Of(file: java.io.File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buf)
                if (read <= 0) break
                digest.update(buf, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
