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
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.test.espresso.Espresso
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

    /*
     * Journal d'avancement.
     *
     * Quand ce parcours echoue, le message d'assertion est dans les
     * traces Gradle — et celles-ci sont tronquees avant lui la ou ce
     * projet les lit. Sans savoir a quelle etape on s'est arrete, on
     * corrige a l'aveugle et on brule un cycle de CI par hypothese.
     * Ce fichier part avec les captures et dit la derniere etape
     * franchie.
     */
    private val journal = StringBuilder()

    private fun etape(quoi: String) {
        journal.appendLine(quoi)
        stockage.openOutputFile("dress-code/parcours.txt").use {
            it.write(journal.toString().toByteArray())
        }
    }

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

    /*
     * Attendre qu'une feuille ait disparu.
     *
     * On ne ferme jamais une feuille par un detour : ni par un appui
     * retour, qui depile la navigation au lieu de la fermer, ni en
     * changeant d'onglet, qui ne la ferme que si l'ecran qui la porte
     * quitte vraiment la composition — et la barre de navigation
     * sauvegarde l'etat des onglets, donc ce n'est pas garanti.
     *
     * Chaque feuille a un bouton qui la ferme. On appuie dessus,
     * comme un couturier. Le parcours teste alors l'application au
     * lieu de la contourner.
     */
    /*
     * Quitter un ecran plein.
     *
     * La barre d'onglets n'existe que sur les quatre onglets : sur la
     * creation d'une commande ou sur une fiche, il n'y a ni barre ni
     * fleche retour, et le retour du telephone est la seule sortie.
     * C'est normal sur Android, et c'est exactement ce a quoi le
     * retour sert — contrairement a la fermeture d'une feuille, ou il
     * depile la navigation au lieu de fermer quoi que ce soit.
     */
    private fun quitterEcran(temoin: String) {
        etape("  quitter l'écran (témoin $temoin)")
        Espresso.pressBack()
        regle.waitUntil(timeoutMillis = 10_000) {
            regle.onAllNodesWithTag(temoin).fetchSemanticsNodes().isEmpty()
        }
        regle.waitForIdle()
    }

    private fun attendreFermeture(etiquette: String) {
        regle.waitUntil(timeoutMillis = 10_000) {
            regle.onAllNodesWithTag(etiquette).fetchSemanticsNodes().isEmpty()
        }
        regle.waitForIdle()
    }

    @Test
    fun parcourirLApplicationEtCapturerChaqueEcran() {
        semer()
        regle.waitForIdle()

        capturer("01-aujourdhui")
        etape("01 aujourdhui")

        onglet("commandes").performClick()
        capturer("02-commandes")
        etape("02 commandes")

        onglet("clients").performClick()
        capturer("03-clientes")
        etape("03 clientes")

        onglet("modeles").performClick()
        capturer("04-catalogue-vide")
        etape("04 catalogue vide")

        /* Le catalogue vide invite a ajouter un modele. On repond a
           l'invitation pour de vrai : la feuille s'ouvre, on la
           remplit, on enregistre. C'est aussi ce qui donnera au
           catalogue de quoi etre choisi plus loin. */
        regle.onNodeWithTag("action-principale").performClick()
        regle.onNodeWithTag("nom-modele").performTextInput("Boubou brodé")
        regle.onNodeWithTag("prix-modele").performTextInput("45000")
        capturerFeuille("05-fiche-modele", etiquette = "feuille-modele")
        etape("05 feuille modele")
        regle.onNodeWithTag("enregistrer-modele").performClick()
        attendreFermeture("feuille-modele")
        capturer("06-catalogue")
        etape("06 catalogue rempli")

        /* La creation de commande, avec un catalogue qui a de quoi
           proposer : le bouton n'apparait que dans ce cas. */
        onglet("aujourdhui").performClick()
        regle.waitForIdle()
        regle.onNodeWithTag("action-principale").performClick()
        capturer("07-nouvelle-commande")
        etape("07 nouvelle commande")

        regle.onNodeWithTag("liste-nouvelle-commande")
            .performScrollToNode(hasTestTag("choisir-modele"))
        regle.onNodeWithTag("choisir-modele").performClick()
        capturerFeuille("08-catalogue-choix", etiquette = "feuille-catalogue")
        etape("08 choix au catalogue")
        /* Choisir un modele ferme la feuille et remplit l'etape 3. */
        regle.onNodeWithText("Boubou brodé").performClick()
        attendreFermeture("feuille-catalogue")

        /* Le calendrier : sa boite de dialogue se referme par son
           propre bouton Annuler. */
        regle.onNodeWithTag("liste-nouvelle-commande")
            .performScrollToNode(hasTestTag("choisir-date"))
        regle.onNodeWithTag("choisir-date").performClick()
        regle.waitUntil(timeoutMillis = 10_000) {
            regle.onAllNodesWithText("Choisir").fetchSemanticsNodes().isNotEmpty()
        }
        etape("09 calendrier ouvert")
        regle.onNodeWithText("Annuler").performClick()
        regle.waitForIdle()
        quitterEcran("liste-nouvelle-commande")

        /* Les mesures se corrigent depuis la commande : c'est ce que
           l'ecran ne permettait pas. Les douze du metier y sont, plus
           « Tour de tête », nommee a la main. */
        onglet("commandes").performClick()
        ouvrirRobeCeremonie()
        capturer("10-commande")
        etape("10 commande")

        regle.onNodeWithTag("liste-commande")
            .performScrollToNode(hasTestTag("mesures-commande"))
        regle.onNodeWithTag("mesures-commande").performClick()
        capturerFeuille("11-mesures", etiquette = "feuille-mesures")
        etape("11 mesures")
        regle.onNodeWithTag("enregistrer-mesures").performClick()
        attendreFermeture("feuille-mesures")
        etape("  mesures enregistrées")

        /* La fiche envoyee a la cliente, en dernier : son bouton
           ouvre WhatsApp, donc on ne l'appuie pas, et rien ne suit.

           On remonte d'abord : la liste est restee la ou on l'avait
           laissee, en bas sur les mesures, et « Envoyer la fiche » est
           en haut avec le bouton de statut. */
        regle.onNodeWithTag("liste-commande")
            .performScrollToNode(hasTestTag("envoyer-fiche"))
        regle.onNodeWithTag("envoyer-fiche").performClick()
        etape("  fiche demandée")
        regle.waitUntil(timeoutMillis = 15_000) {
            regle.onAllNodesWithTag("apercu-recapitulatif").fetchSemanticsNodes().isNotEmpty()
        }
        capturerFeuille("12-recapitulatif", etiquette = "feuille-recapitulatif")
        etape("12 recapitulatif")
    }

    private fun ouvrirRobeCeremonie() {
        etape("  ouvrir Robe cérémonie")
        regle.waitForIdle()
        regle.onNodeWithText("Robe cérémonie").performClick()
        regle.waitForIdle()
    }
}
