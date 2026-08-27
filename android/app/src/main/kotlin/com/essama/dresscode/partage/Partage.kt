package com.essama.dresscode.partage

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/*
 * L'application prepare l'image et le texte, puis ouvre le partage
 * du telephone. C'est le couturier qui appuie sur « envoyer ».
 *
 * Ce choix n'est pas de la prudence de principe. WhatsApp suspend les
 * numeros qui envoient en masse sans sollicitation, et un couturier
 * dont le numero professionnel est bloque perd son carnet d'adresses
 * du jour au lendemain. Une seule cliente, un seul envoi, decide sur
 * le moment : pas de selection multiple de clientes, pas de
 * programmation, pas de campagne.
 */

private const val WHATSAPP = "com.whatsapp"
private const val WHATSAPP_BUSINESS = "com.whatsapp.w4b"

class Partage(private val contexte: Context) {

    private val dossier: File
        get() = File(contexte.cacheDir, "partage").apply { mkdirs() }

    /**
     * Ecrit l'image dans le cache et rend l'adresse que WhatsApp
     * pourra lire. Le cache : ces fichiers n'ont pas a rester.
     */
    suspend fun ecrireImage(image: Bitmap, nom: String): Uri = withContext(Dispatchers.IO) {
        val cible = File(dossier, "$nom.jpg")
        cible.outputStream().use { image.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        adresse(cible)
    }

    /**
     * PDF d'une page, pour les commandes importantes ou la cliente
     * veut un document a imprimer. L'image reste le defaut : elle
     * s'affiche dans WhatsApp sans telechargement, sur n'importe quel
     * telephone.
     */
    suspend fun ecrirePdf(image: Bitmap, nom: String): Uri = withContext(Dispatchers.IO) {
        val a4Largeur = 595
        val a4Hauteur = 842
        val document = PdfDocument()
        val page = document.startPage(
            PdfDocument.PageInfo.Builder(a4Largeur, a4Hauteur, 1).create(),
        )

        val echelle = minOf(
            (a4Largeur - 40f) / image.width,
            (a4Hauteur - 40f) / image.height,
        )
        val l = image.width * echelle
        val h = image.height * echelle
        page.canvas.drawBitmap(
            image,
            null,
            android.graphics.RectF(
                (a4Largeur - l) / 2, (a4Hauteur - h) / 2,
                (a4Largeur + l) / 2, (a4Hauteur + h) / 2,
            ),
            android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG),
        )
        document.finishPage(page)

        val cible = File(dossier, "$nom.pdf")
        cible.outputStream().use { document.writeTo(it) }
        document.close()
        adresse(cible)
    }

    private fun adresse(fichier: File): Uri =
        FileProvider.getUriForFile(contexte, "${contexte.packageName}.fichiers", fichier)

    /**
     * Ouvre le partage sur WhatsApp quand il est installe, sinon sur
     * la feuille de partage du systeme. Dans les deux cas, c'est le
     * couturier qui choisit la destinataire et appuie sur envoyer.
     */
    fun partager(fichiers: List<Uri>, texte: String, type: String = "image/jpeg"): Intent {
        val intention = if (fichiers.size == 1) {
            Intent(Intent.ACTION_SEND).apply {
                setType(type)
                putExtra(Intent.EXTRA_STREAM, fichiers.first())
            }
        } else {
            Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                setType(type)
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(fichiers))
            }
        }
        intention.putExtra(Intent.EXTRA_TEXT, texte)
        intention.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        /* Viser WhatsApp directement epargne un appui, mais seulement
           s'il est la : forcer un paquet absent ferait planter. */
        val paquet = listOf(WHATSAPP, WHATSAPP_BUSINESS).firstOrNull { installe(it) }
        if (paquet != null) intention.setPackage(paquet)

        return Intent.createChooser(intention, "Envoyer à la cliente")
    }

    /** Ouvre la conversation WhatsApp de la cliente, sans piece jointe. */
    fun conversation(telephone: String, indicatif: String, texte: String): Intent {
        val numero = numeroInternational(telephone, indicatif)
        val adresse = if (numero.isEmpty()) {
            "https://wa.me/?text=${Uri.encode(texte)}"
        } else {
            "https://wa.me/$numero?text=${Uri.encode(texte)}"
        }
        return Intent(Intent.ACTION_VIEW, Uri.parse(adresse))
    }

    fun appeler(telephone: String): Intent =
        Intent(Intent.ACTION_DIAL, Uri.parse("tel:${telephone.filter { !it.isWhitespace() }}"))

    private fun installe(paquet: String): Boolean = runCatching {
        contexte.packageManager.getPackageInfo(paquet, 0)
    }.isSuccess

    fun viderCache() {
        dossier.listFiles()?.forEach { it.delete() }
    }
}
