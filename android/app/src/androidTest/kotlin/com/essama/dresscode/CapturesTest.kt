package com.essama.dresscode

import android.graphics.Bitmap
import android.os.Environment
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.time.LocalDate

/*
 * Parcourt l'application sur un vrai appareil et enregistre une
 * capture par ecran.
 *
 * Ces captures sont la seule facon de voir l'interface : le SDK
 * Android n'est pas disponible dans l'environnement ou le code est
 * ecrit. Elles servent donc autant de verification que de preuve —
 * un ecran qui ne se rend pas fait echouer le test avant meme la
 * capture.
 */
class CapturesTest {

    @get:Rule
    val regle = createAndroidComposeRule<MainActivity>()

    private val dossier: File by lazy {
        val contexte = InstrumentationRegistry.getInstrumentation().targetContext
        File(contexte.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "dress-code")
            .apply { mkdirs() }
    }

    private fun capturer(nom: String) {
        regle.waitForIdle()
        val image: Bitmap = regle.onRoot().captureToImage().asAndroidBitmap()
        File(dossier, "$nom.png").outputStream().use {
            image.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    /* Un atelier realiste : un ecran vide ne montrerait rien de ce
       qui compte, et ne verifierait presque rien. */
    private fun semer() = runBlocking {
        val application = InstrumentationRegistry.getInstrumentation()
            .targetContext.applicationContext as DressCodeApplication
        val depot = application.depot

        depot.reglages.enregistrerAtelier(
            com.essama.dresscode.metier.Atelier(
                nom = "Atelier Kadi Couture",
                telephone = "77 123 45 67",
                adresse = "Médina, Dakar",
            ),
        )

        val clientes = listOf(
            "Fatou Sow" to "77 123 45 67",
            "Aminata Kébé" to "76 998 12 03",
            "M. Traoré" to "70 112 88 45",
            "Awa Ndiaye" to "77 654 32 10",
        )
        val identifiants = clientes.map { (nom, telephone) ->
            depot.enregistrerClient(
                com.essama.dresscode.metier.Client(
                    nom = nom,
                    telephone = telephone,
                    mesures = mapOf(
                        com.essama.dresscode.metier.Mesure.POITRINE to "92",
                        com.essama.dresscode.metier.Mesure.TAILLE to "74",
                        com.essama.dresscode.metier.Mesure.HANCHES to "100",
                        com.essama.dresscode.metier.Mesure.EPAULE to "38",
                        com.essama.dresscode.metier.Mesure.MANCHE to "58",
                        com.essama.dresscode.metier.Mesure.LONGUEUR to "138",
                    ),
                    mesuresMajLe = System.currentTimeMillis() - 40L * 86_400_000,
                ),
            )
        }

        val aujourdhui = LocalDate.now()
        /* Un jeu de dates qui produit du retard, des livraisons du
           jour et un vetement a commencer : les trois blocs que
           l'ecran d'accueil doit savoir distinguer. */
        val commandes = listOf(
            Triple("Robe cérémonie", 0, -2L),
            Triple("Costume mariage", 2, -1L),
            Triple("Boubou brodé", 1, 0L),
            Triple("Tailleur", 3, 0L),
            Triple("Robe cintrée", 1, 5L),
        )
        commandes.forEachIndexed { index, (modele, cliente, decalage) ->
            depot.ajouterCommande(
                com.essama.dresscode.metier.Commande(
                    clientId = identifiants[cliente],
                    modeleNom = modele,
                    cadence = com.essama.dresscode.metier.Cadence.LONGUE,
                    statut = if (index % 2 == 0) {
                        com.essama.dresscode.metier.Statut.A_COMMENCER
                    } else {
                        com.essama.dresscode.metier.Statut.EN_CONFECTION
                    },
                    dateCommande = aujourdhui.minusDays(14),
                    dateLivraison = aujourdhui.plusDays(decalage),
                    prixTotal = 50_000 + index * 10_000L,
                    acompte = 20_000,
                ),
            )
        }
    }

    @Test
    fun parcourirLApplicationEtCapturerChaqueEcran() {
        semer()
        regle.waitForIdle()

        capturer("01-aujourdhui")

        regle.onNodeWithText("Commandes").performClick()
        capturer("02-commandes")

        regle.onNodeWithText("Clientes").performClick()
        capturer("03-clientes")

        regle.onNodeWithText("Modèles").performClick()
        capturer("04-modeles")

        /* Retour a l'accueil puis creation : c'est le parcours qui
           decide de l'adoption, il merite sa capture. */
        regle.onNodeWithText("Aujourd’hui").performClick()
        regle.waitForIdle()
        regle.onNodeWithText("Commande").performClick()
        capturer("05-nouvelle-commande")

        val produites = dossier.listFiles()?.size ?: 0
        assertTrue("aucune capture produite dans $dossier", produites >= 5)
    }
}
