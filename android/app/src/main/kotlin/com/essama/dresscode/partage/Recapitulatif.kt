package com.essama.dresscode.partage

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.material3.ColorScheme
import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.dateCourte
import com.essama.dresscode.metier.dateLongue
import com.essama.dresscode.metier.montant

/*
 * La fiche que la cliente recoit.
 *
 * C'est l'ajout qui separe le plus l'application du cahier : une
 * trace ecrite, horodatee, envoyee le jour meme. Elle sert trois
 * fois — a la commande, quand le vetement est pret, a la livraison
 * comme recu — et circule ensuite de cliente en cliente avec le nom
 * de l'atelier dessus.
 *
 * Elle est toujours dessinee dans les couleurs claires : elle part
 * chez la cliente, elle ne doit pas suivre le mode sombre du
 * couturier.
 */

private const val LARGEUR = 1080
private const val MARGE = 72f

class DessinRecapitulatif(
    private val couleurs: ColorScheme,
    private val marque: Typeface,
    private val courant: Typeface,
) {

    private fun teinte(couleur: androidx.compose.ui.graphics.Color): Int =
        Color.argb(
            (couleur.alpha * 255).toInt(),
            (couleur.red * 255).toInt(),
            (couleur.green * 255).toInt(),
            (couleur.blue * 255).toInt(),
        )

    fun dessiner(
        atelier: Atelier,
        client: Client,
        commande: Commande,
        photo: Bitmap?,
        variante: Variante,
    ): Bitmap {
        val largeurUtile = LARGEUR - MARGE * 2
        val solde = variante == Variante.LIVREE || commande.soldeRegle

        val hauteurEntete = 224f
        val hauteurPhoto = if (photo != null) largeurUtile * 0.72f else 0f
        val hauteurLivraison = 148f
        val hauteurArgent = if (solde) 150f else 236f
        val hauteur = (
            hauteurEntete + (if (photo != null) hauteurPhoto + 60f else 24f) +
                3 * 62f + 40f + hauteurLivraison + 40f + hauteurArgent + 128f
            ).toInt()

        val image = Bitmap.createBitmap(LARGEUR, hauteur, Bitmap.Config.ARGB_8888)
        val toile = Canvas(image)

        val fond = Paint().apply { color = teinte(couleurs.surface) }
        toile.drawRect(0f, 0f, LARGEUR.toFloat(), hauteur.toFloat(), fond)

        dessinerEntete(toile, atelier, variante, hauteurEntete)

        var y = hauteurEntete + 48f

        if (photo != null) {
            dessinerPhoto(toile, photo, y, largeurUtile, hauteurPhoto)
            y += hauteurPhoto + 60f
        } else {
            y += 24f
        }

        ligne(toile, y, "Cliente", client.nom, largeurUtile)
        y += 62f
        ligne(toile, y, "Modèle", commande.modeleNom, largeurUtile)
        y += 62f
        ligne(toile, y, "Commandé le", dateCourte(commande.dateCommande), largeurUtile)
        y += 62f + 28f

        dessinerLivraison(toile, commande, y, largeurUtile, hauteurLivraison)
        y += hauteurLivraison + 40f

        y = dessinerArgent(toile, commande, y, largeurUtile, solde)

        val pied = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = courant
            textSize = 28f
            color = teinte(couleurs.onSurfaceVariant)
            textAlign = Paint.Align.CENTER
        }
        toile.drawText(variante.pied, LARGEUR / 2f, hauteur - 56f, pied)

        return image
    }

    /* L'entete fait circuler l'adresse de l'atelier : c'est le seul
       canal d'acquisition gratuit du produit. */
    private fun dessinerEntete(toile: Canvas, atelier: Atelier, variante: Variante, hauteur: Float) {
        toile.drawRect(
            0f, 0f, LARGEUR.toFloat(), hauteur,
            Paint().apply { color = teinte(couleurs.primary) },
        )

        val titre = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(marque, Typeface.BOLD)
            textSize = 52f
            color = teinte(couleurs.onPrimary)
            textAlign = Paint.Align.CENTER
        }
        toile.drawText(
            tronquer(atelier.nom.ifBlank { "Atelier" }, titre, LARGEUR - MARGE * 2),
            LARGEUR / 2f, 96f, titre,
        )

        val details = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = courant
            textSize = 28f
            color = teinte(couleurs.onPrimary)
            alpha = 217
            textAlign = Paint.Align.CENTER
        }
        val coordonnees = listOf(atelier.telephone, atelier.adresse)
            .filter { it.isNotBlank() }
            .joinToString("  ·  ")
        if (coordonnees.isNotEmpty()) {
            toile.drawText(tronquer(coordonnees, details, LARGEUR - MARGE * 2), LARGEUR / 2f, 142f, details)
        }

        val etiquette = Paint(details).apply { textSize = 26f }
        toile.drawText(variante.titre.uppercase(), LARGEUR / 2f, 190f, etiquette)
    }

    private fun dessinerPhoto(toile: Canvas, photo: Bitmap, y: Float, largeur: Float, hauteur: Float) {
        val cadre = RectF(MARGE, y, MARGE + largeur, y + hauteur)
        val chemin = android.graphics.Path().apply {
            addRoundRect(cadre, 32f, 32f, android.graphics.Path.Direction.CW)
        }
        toile.save()
        toile.clipPath(chemin)

        /* Remplit le cadre sans deformer : une robe etiree n'inspire
           pas confiance. */
        val echelle = maxOf(largeur / photo.width, hauteur / photo.height)
        val l = photo.width * echelle
        val h = photo.height * echelle
        val destination = RectF(
            cadre.centerX() - l / 2, cadre.centerY() - h / 2,
            cadre.centerX() + l / 2, cadre.centerY() + h / 2,
        )
        toile.drawBitmap(photo, Rect(0, 0, photo.width, photo.height), destination, Paint(Paint.FILTER_BITMAP_FLAG))
        toile.restore()
    }

    /* La date de livraison est la seule information que la cliente
       doit retenir : elle a sa propre bande. */
    private fun dessinerLivraison(
        toile: Canvas,
        commande: Commande,
        y: Float,
        largeur: Float,
        hauteur: Float,
    ) {
        toile.drawRoundRect(
            RectF(MARGE, y, MARGE + largeur, y + hauteur - 24f), 28f, 28f,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = teinte(couleurs.primaryContainer) },
        )

        val etiquette = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = courant
            textSize = 26f
            color = teinte(couleurs.onPrimaryContainer)
        }
        toile.drawText("LIVRAISON", MARGE + 40f, y + 50f, etiquette)

        val date = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(marque, Typeface.BOLD)
            textSize = 42f
            color = teinte(couleurs.onPrimaryContainer)
        }
        toile.drawText(
            tronquer(dateLongue(commande.dateLivraison), date, largeur - 80f),
            MARGE + 40f, y + 104f, date,
        )
    }

    private fun dessinerArgent(
        toile: Canvas,
        commande: Commande,
        depart: Float,
        largeur: Float,
        solde: Boolean,
    ): Float {
        var y = depart
        if (solde) {
            ligne(toile, y, "Montant réglé", montant(commande.prixTotal), largeur, fort = true)
            return y + 76f
        }
        ligne(toile, y, "Montant total", montant(commande.prixTotal), largeur)
        y += 62f
        ligne(toile, y, "Avance versée", montant(commande.acompte), largeur)
        y += 44f
        toile.drawRect(
            MARGE, y, MARGE + largeur, y + 2f,
            Paint().apply { color = teinte(couleurs.outlineVariant) },
        )
        y += 58f
        ligne(
            toile, y, "Reste à payer", montant(commande.reste), largeur,
            fort = true, couleur = teinte(couleurs.primary),
        )
        return y + 76f
    }

    private fun ligne(
        toile: Canvas,
        y: Float,
        gauche: String,
        droite: String,
        largeur: Float,
        fort: Boolean = false,
        couleur: Int? = null,
    ) {
        val etiquette = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = courant
            textSize = 30f
            color = teinte(couleurs.onSurfaceVariant)
        }
        toile.drawText(gauche, MARGE, y, etiquette)

        val valeur = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = if (fort) Typeface.create(courant, Typeface.BOLD) else courant
            textSize = if (fort) 36f else 30f
            color = couleur ?: teinte(couleurs.onSurface)
            textAlign = Paint.Align.RIGHT
        }
        toile.drawText(tronquer(droite, valeur, largeur * 0.62f), LARGEUR - MARGE, y, valeur)
    }

    /* Un nom de modele bavard ne doit pas sortir de la fiche. */
    private fun tronquer(texte: String, pinceau: Paint, largeurMax: Float): String {
        if (pinceau.measureText(texte) <= largeurMax) return texte
        var coupe = texte
        while (coupe.length > 1 && pinceau.measureText("$coupe…") > largeurMax) {
            coupe = coupe.dropLast(1)
        }
        return "${coupe.trimEnd()}…"
    }
}
