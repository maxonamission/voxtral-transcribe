package io.github.maxonamission.voxtral.keyboard.model

import android.content.Context
import io.github.maxonamission.voxtral.keyboard.core.ModelManifest
import java.io.File

class ModelStorage(private val context: Context) {

    fun modelDir(): File = File(context.filesDir, "models").apply { mkdirs() }

    fun finalFile(manifest: ModelManifest): File = File(modelDir(), manifest.fileName)

    fun partialFile(manifest: ModelManifest): File =
        File(modelDir(), "${manifest.fileName}.partial")

    /** True if a verified model file is present at the expected location. */
    fun isPresent(manifest: ModelManifest): Boolean = finalFile(manifest).let {
        it.exists() && it.length() == manifest.sizeBytes
    }

    fun delete(manifest: ModelManifest) {
        finalFile(manifest).delete()
        partialFile(manifest).delete()
    }

    /**
     * Free bytes on the volume that hosts [Context.getFilesDir]. Useful for
     * the pre-flight check ("do we have 2× model size free?").
     */
    fun freeBytes(): Long = context.filesDir.freeSpace
}
