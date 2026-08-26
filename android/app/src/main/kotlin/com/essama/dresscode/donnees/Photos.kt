package com.essama.dresscode.donnees

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/*
 * Une photo de telephone pese 3 a 8 Mo. Gardees telles quelles,
 * trente modeles saturent le stockage et chaque ouverture de liste
 * rame. On reduit avant d'enregistrer : 1 280 px suffisent pour
 * montrer un modele a une cliente et pour le recapitulatif WhatsApp.
 *
 * Les fichiers vivent dans le stockage prive de l'application : ils
 * ne rejoignent pas la galerie du telephone, ou ils se melangeraient
 * aux photos de famille.
 */

private const val COTE_MAX = 1280
private const val QUALITE = 82

class Photos(private val contexte: Context) {

    private val dossier: File
        get() = File(contexte.filesDir, "photos").apply { mkdirs() }

    fun fichier(nom: String): File = File(dossier, nom)

    /** Rend le nom du fichier enregistre, a garder en base. */
    suspend fun enregistrer(source: Uri): String? = withContext(Dispatchers.IO) {
        val image = lireEtReduire(source) ?: return@withContext null
        val nom = "${UUID.randomUUID()}.jpg"
        fichier(nom).outputStream().use { flux ->
            image.compress(Bitmap.CompressFormat.JPEG, QUALITE, flux)
        }
        image.recycle()
        nom
    }

    suspend fun charger(nom: String?): Bitmap? = withContext(Dispatchers.IO) {
        if (nom == null) return@withContext null
        val cible = fichier(nom)
        if (!cible.exists()) return@withContext null
        BitmapFactory.decodeFile(cible.absolutePath)
    }

    fun supprimer(nom: String?) {
        if (nom == null) return
        fichier(nom).delete()
    }

    private fun lireEtReduire(source: Uri): Bitmap? {
        /* Premiere passe sans decoder les pixels : on ne charge jamais
           l'image pleine taille en memoire, ce qui ferait tomber
           l'application sur un telephone d'entree de gamme. */
        val dimensions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contexte.contentResolver.openInputStream(source)?.use {
            BitmapFactory.decodeStream(it, null, dimensions)
        } ?: return null

        val options = BitmapFactory.Options().apply {
            inSampleSize = facteurReduction(dimensions.outWidth, dimensions.outHeight)
        }
        val brute = contexte.contentResolver.openInputStream(source)?.use {
            BitmapFactory.decodeStream(it, null, options)
        } ?: return null

        val redresse = redresser(brute, source)
        return ajuster(redresse)
    }

    private fun facteurReduction(largeur: Int, hauteur: Int): Int {
        var facteur = 1
        while (maxOf(largeur, hauteur) / (facteur * 2) >= COTE_MAX) facteur *= 2
        return facteur
    }

    private fun ajuster(image: Bitmap): Bitmap {
        val cote = maxOf(image.width, image.height)
        if (cote <= COTE_MAX) return image
        val echelle = COTE_MAX.toFloat() / cote
        val reduite = Bitmap.createScaledBitmap(
            image,
            (image.width * echelle).toInt(),
            (image.height * echelle).toInt(),
            true,
        )
        if (reduite !== image) image.recycle()
        return reduite
    }

    /* Sans cette lecture EXIF, une photo prise en portrait arrive
       couchee dans le recapitulatif envoye a la cliente. */
    private fun redresser(image: Bitmap, source: Uri): Bitmap {
        val orientation = contexte.contentResolver.openInputStream(source)?.use {
            ExifInterface(it).getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL,
            )
        } ?: return image

        val rotation = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return image
        }

        val matrice = Matrix().apply { postRotate(rotation) }
        val tournee = Bitmap.createBitmap(image, 0, 0, image.width, image.height, matrice, true)
        if (tournee !== image) image.recycle()
        return tournee
    }
}
