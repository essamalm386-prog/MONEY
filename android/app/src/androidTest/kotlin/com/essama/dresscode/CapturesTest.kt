package com.essama.dresscode

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.espresso.Espresso
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.services.storage.TestStorage
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
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

    /* Le stockage de test est le seul chemin de sortie fiable : le
       dossier externe de l'application est masque a adb depuis
       Android 11, et Gradle rapatrie ce stockage-ci tout seul. */
    private val stockage = TestStorage()

    private fun ecrire(nom: String, image: Bitmap) {
        stockage.openOutputFile("dress-code/$nom.png").use {
            image.compress(Bitmap.CompressFormat.PNG, 100, it)
        }
    }

    /* Capture l'arbre Compose : un ecran qui ne se rend pas fait
       echouer le test ici meme, avant l'enregistrement. */
    private fun capturer(nom: String) {
        regle.waitForIdle()
        ecrire(nom, regle.onRoot().captureToImage().asAndroidBitmap())
    }

    /* Une feuille du bas vit dans sa propre fenetre : l'arbre Compose
       a alors deux racines et onRoot() ne sait plus laquelle prendre.
       On passe par l'ecran de l'appareil, apres avoir verifie qu'un
       noeud de la feuille est bien la. */
    private fun capturerAppareil(nom: String, temoin: String) {
        regle.waitForIdle()
        regle.onNodeWithTag(temoin).assertExists()
        ecrire(nom, InstrumentationRegistry.getInstrumentation().uiAutomation.takeScreenshot())
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

    /* On vise les etiquettes de test et non les libelles : « Aujourd'hui »
       est a la fois un onglet et un titre d'ecran, et un texte de
       l'interface change au fil de la redaction. */
    private fun onglet(route: String) = regle.onNodeWithTag("onglet-$route")

    /* Le retour ferme la feuille, mais l'animation continue : cliquer
       trop tot, c'est cliquer sur le voile qui la couvre encore. */
    private fun fermerFeuille(temoin: String) {
        Espresso.pressBack()
        regle.waitUntil(timeoutMillis = 5_000) {
            regle.onAllNodesWithTag(temoin).fetchSemanticsNodes().isEmpty()
        }
    }

    @Test
    fun parcourirLApplicationEtCapturerChaqueEcran() {
        semer()
        regle.waitForIdle()

        capturer("01-aujourdhui")

        onglet("commandes").performClick()
        capturer("02-commandes")

        onglet("clients").performClick()
        capturer("03-clientes")

        onglet("modeles").performClick()
        capturer("04-modeles")

        /* Le catalogue vide invite a ajouter un modele : la feuille
           qui repond a cette invitation doit s'ouvrir pour de vrai. */
        regle.onNodeWithTag("action-principale").performClick()
        capturerAppareil("05-fiche-modele", temoin = "nom-modele")
        fermerFeuille("nom-modele")

        /* Retour a l'accueil, puis creation : c'est le parcours qui
           decide de l'adoption, il merite sa capture. */
        onglet("aujourdhui").performClick()
        regle.waitForIdle()
        regle.onNodeWithTag("action-principale").performClick()
        capturer("06-nouvelle-commande")
        Espresso.pressBack()
        regle.waitForIdle()

        /* La fiche envoyee a la cliente : le dessin passe par un
           Canvas hors Compose, c'est le seul endroit ou une capture
           verifie vraiment quelque chose. */
        onglet("commandes").performClick()
        regle.waitForIdle()
        regle.onNodeWithText("Robe cérémonie").performClick()
        regle.waitForIdle()
        capturer("07-commande")

        regle.onNodeWithTag("envoyer-fiche").performClick()
        /* L'apercu est dessine hors du fil principal : waitForIdle ne
           l'attend pas, il faut guetter le noeud lui-meme. */
        regle.waitUntil(timeoutMillis = 15_000) {
            regle.onAllNodesWithTag("apercu-recapitulatif").fetchSemanticsNodes().isNotEmpty()
        }
        capturerAppareil("08-recapitulatif", temoin = "apercu-recapitulatif")
    }
}
