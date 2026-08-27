package com.essama.dresscode

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.geometry.Rect
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
       On capture donc la feuille elle-meme, par son etiquette.

       waitForIdle ne suffit pas ici : il rend la main pendant que la
       feuille monte encore, et la capture attrape l'ecran du dessous.
       On attend que ses bords ne bougent plus. */
    private fun capturerFeuille(nom: String, etiquette: String) {
        var precedent = Rect.Zero
        var immobile = 0
        regle.waitUntil(timeoutMillis = 15_000) {
            val bords = regle.onNodeWithTag(etiquette).fetchSemanticsNode().boundsInWindow
            immobile = if (bords == precedent && bords.height > 0f) immobile + 1 else 0
            precedent = bords
            immobile >= 3
        }
        ecrire(nom, regle.onNodeWithTag(etiquette).captureToImage().asAndroidBitmap())
    }

    /* Le retour passe par l'activite, pas par le systeme : une boite de
       dialogue de l'emulateur — « Pixel Launcher isn't responding » en a
       deja couvert une execution — vole le focus et fait echouer un
       appui retour envoye au systeme. */
    private fun retour() = regle.runOnUiThread {
        regle.activity.onBackPressedDispatcher.onBackPressed()
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
                        com.essama.dresscode.metier.Mesure.POITRINE.cle to "92",
                        com.essama.dresscode.metier.Mesure.TAILLE.cle to "74",
                        com.essama.dresscode.metier.Mesure.HANCHES.cle to "100",
                        com.essama.dresscode.metier.Mesure.EPAULE.cle to "38",
                        com.essama.dresscode.metier.Mesure.MANCHE.cle to "58",
                        com.essama.dresscode.metier.Mesure.LONGUEUR.cle to "138",
                        /* Une mesure que le couturier a nommee lui-meme :
                           la capture doit montrer qu'elle tient sa place
                           a cote des douze du metier. */
                        "Tour de tête" to "56",
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
                    mesures = mapOf(
                        com.essama.dresscode.metier.Mesure.POITRINE.cle to "92",
                        com.essama.dresscode.metier.Mesure.TAILLE.cle to "74",
                        com.essama.dresscode.metier.Mesure.LONGUEUR.cle to "138",
                        "Tour de tête" to "56",
                    ),
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
    private fun fermerFeuille(etiquette: String) {
        retour()
        regle.waitUntil(timeoutMillis = 10_000) {
            regle.onAllNodesWithTag(etiquette).fetchSemanticsNodes().isEmpty()
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
        capturerFeuille("05-fiche-modele", etiquette = "feuille-modele")
        fermerFeuille("feuille-modele")

        /* Retour a l'accueil, puis creation : c'est le parcours qui
           decide de l'adoption, il merite sa capture. */
        onglet("aujourdhui").performClick()
        regle.waitForIdle()
        regle.onNodeWithTag("action-principale").performClick()
        capturer("06-nouvelle-commande")
        retour()
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
        capturerFeuille("08-recapitulatif", etiquette = "feuille-recapitulatif")
        fermerFeuille("feuille-recapitulatif")

        /* Les mesures se corrigent depuis la commande : c'est ce que
           l'ecran ne permettait pas, et la capture doit le montrer —
           les douze du metier, plus « Tour de tête » nommee a la main. */
        /* Le bouton est en bas d'une liste paresseuse : sans defiler
           jusqu'a lui, il n'est meme pas compose. */
        regle.onNodeWithTag("liste-commande")
            .performScrollToNode(hasTestTag("mesures-commande"))
        regle.onNodeWithTag("mesures-commande").performClick()
        capturerFeuille("09-mesures", etiquette = "feuille-mesures")
        fermerFeuille("feuille-mesures")

        /* Le catalogue depuis la commande, et le calendrier : les deux
           que le portage vers Android avait perdus. */
        onglet("aujourdhui").performClick()
        regle.waitForIdle()
        regle.onNodeWithTag("action-principale").performClick()
        regle.waitForIdle()
        regle.onNodeWithTag("liste-nouvelle-commande")
            .performScrollToNode(hasTestTag("choisir-date"))
        regle.onNodeWithTag("choisir-date").performClick()
        /* La boite de dialogue du calendrier vit dans sa propre
           fenetre et n'a pas d'etiquette a nous : on verifie qu'elle
           s'ouvre par son bouton de validation, sans la capturer. */
        regle.waitUntil(timeoutMillis = 10_000) {
            regle.onAllNodesWithText("Choisir").fetchSemanticsNodes().isNotEmpty()
        }
    }
}
