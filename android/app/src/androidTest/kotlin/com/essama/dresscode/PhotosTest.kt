package com.essama.dresscode

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import androidx.test.platform.app.InstrumentationRegistry
import com.essama.dresscode.donnees.Photos
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/*
 * Le couturier choisissait une photo, appuyait sur enregistrer, et
 * elle n'apparaissait nulle part : ni dans la commande, ni dans le
 * catalogue. La cause tenait en une ligne. La passe de mesure
 * (« inJustDecodeBounds ») ne decode aucun pixel — decodeStream y
 * rend toujours null, c'est son contrat. Ce null etait pris pour une
 * erreur de lecture, et chaque photo partait a la poubelle.
 *
 * Aucun test unitaire ne pouvait le voir : BitmapFactory est du code
 * Android, absent de la JVM. Il faut un appareil, donc ce test-ci.
 */
class PhotosTest {

    private val contexte = InstrumentationRegistry.getInstrumentation().targetContext
    private val photos = Photos(contexte)

    @Test
    fun uneImageChoisieEstEnregistree() {
        val source = imageDeTest(800, 600)

        val nom = runBlocking { photos.enregistrer(Uri.fromFile(source)) }

        assertNotNull("Une image lisible doit etre enregistree", nom)
        val range = photos.fichier(nom!!)
        assertTrue("Le fichier doit exister dans le stockage prive", range.exists())
        assertTrue("Le fichier ne doit pas etre vide", range.length() > 0)

        val relu = BitmapFactory.decodeFile(range.absolutePath)
        assertNotNull("Le fichier enregistre doit etre une image valide", relu)
        assertEquals(800, relu.width)
        assertEquals(600, relu.height)

        photos.supprimer(nom)
        source.delete()
    }

    /* Une photo de telephone depasse le cote maximum : elle doit
       arriver reduite, sinon trente modeles saturent le stockage. */
    @Test
    fun uneGrandePhotoEstReduite() {
        val source = imageDeTest(3000, 2000)

        val nom = runBlocking { photos.enregistrer(Uri.fromFile(source)) }
        assertNotNull(nom)

        val relu = BitmapFactory.decodeFile(photos.fichier(nom!!).absolutePath)
        /* Une borne, pas une egalite : l'echelle passe par un flottant
           et le dernier pixel n'a pas d'importance ici. */
        assertTrue("Le cote long doit tenir dans 1280 px", relu.width in 1270..1280)
        assertTrue("La proportion doit etre gardee", relu.height in 840..860)

        photos.supprimer(nom)
        source.delete()
    }

    @Test
    fun unFichierIllisibleNeCasseRien() {
        val faux = File(contexte.cacheDir, "pas-une-image.jpg")
        faux.writeText("ceci n'est pas une image")

        val nom = runBlocking { photos.enregistrer(Uri.fromFile(faux)) }

        assertNull("Un fichier illisible ne doit rien enregistrer", nom)
        faux.delete()
    }

    private fun imageDeTest(largeur: Int, hauteur: Int): File {
        val image = Bitmap.createBitmap(largeur, hauteur, Bitmap.Config.ARGB_8888)
        image.eraseColor(Color.rgb(63, 61, 158))
        val cible = File(contexte.cacheDir, "source-${largeur}x$hauteur.jpg")
        cible.outputStream().use { image.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        image.recycle()
        return cible
    }
}
