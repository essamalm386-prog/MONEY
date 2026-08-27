package com.essama.dresscode.partage

import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.ModeleCatalogue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/*
 * Les textes partent chez la cliente : une faute s'y voit, et un
 * numero mal forme ouvre WhatsApp sur personne.
 */
class TextesTest {

    private val atelier = Atelier(
        nom = "Atelier Kadi Couture",
        telephone = "77 123 45 67",
        adresse = "Médina, Dakar",
        indicatif = "221",
    )

    private val cliente = Client(id = 1, nom = "Fatou Sow", telephone = "77 123 45 67")

    private val commande = Commande(
        id = 1,
        clientId = 1,
        modeleNom = "Robe cérémonie",
        dateCommande = LocalDate.of(2026, 8, 26),
        dateLivraison = LocalDate.of(2026, 8, 30),
        prixTotal = 50_000,
        acompte = 35_000,
    )

    @Test
    fun `un numero local est complete par l'indicatif de l'atelier`() {
        assertEquals("221771234567", numeroInternational("77 123 45 67", "221"))
    }

    @Test
    fun `un numero deja international n'est pas prefixe deux fois`() {
        assertEquals("221771234567", numeroInternational("+221 77 123 45 67", "221"))
        assertEquals("221771234567", numeroInternational("00221771234567", "221"))
        assertEquals("221771234567", numeroInternational("221771234567", "221"))
    }

    @Test
    fun `un numero absent ne fabrique pas un indicatif seul`() {
        assertEquals("", numeroInternational("", "221"))
        assertEquals("", numeroInternational("   ", "221"))
    }

    @Test
    fun `sans indicatif d'atelier le numero passe tel quel`() {
        assertEquals("771234567", numeroInternational("77 123 45 67", ""))
    }

    @Test
    fun `le message de commande nomme la cliente par son prenom`() {
        val texte = texteRecapitulatif(atelier, cliente, commande, Variante.COMMANDE)
        assertTrue(texte.startsWith("Bonjour Fatou,"))
        assertTrue(texte.contains("Atelier Kadi Couture — 77 123 45 67"))
    }

    /* Les montants portent des espaces insecables : les ecrire en
       echappement evite de comparer avec une espace ordinaire, qui
       ressemble a l'oeil mais n'est pas le meme caractere. */
    private val insecable = "\u00a0"

    @Test
    fun `le message « prete » rappelle le solde, et se tait s'il n'y en a pas`() {
        val avecSolde = texteRecapitulatif(atelier, cliente, commande, Variante.PRETE)
        assertTrue(avecSolde.contains("Reste à régler : 15${insecable}000${insecable}F."))
        assertTrue(
            "le nom du modele ne doit pas gouverner l'accord",
            avecSolde.contains("votre commande est prête : Robe cérémonie."),
        )

        val soldee = texteRecapitulatif(
            atelier, cliente, commande.copy(soldeRegle = true), Variante.PRETE,
        )
        assertTrue("un solde regle n'a pas a etre reclame", !soldee.contains("Reste à régler"))
    }

    @Test
    fun `le message de modeles annonce des prix indicatifs`() {
        val texte = texteModeles(
            atelier, cliente,
            listOf(
                ModeleCatalogue(nom = "Boubou brodé", prixIndicatif = 45_000),
                ModeleCatalogue(nom = "Robe cintrée", prixIndicatif = 35_000),
            ),
        )
        assertTrue(texte.contains("— Boubou brodé, à partir de 45${insecable}000${insecable}F"))
        assertTrue(texte.contains("— Robe cintrée, à partir de 35${insecable}000${insecable}F"))
        assertTrue(
            "« a partir de » n'est pas un prix ferme : le tarif reel depend du tissu",
            texte.contains("à partir de"),
        )
    }

    @Test
    fun `un modele sans prix ne montre pas un montant a zero`() {
        val texte = texteModeles(atelier, cliente, listOf(ModeleCatalogue(nom = "Tailleur")))
        assertTrue(texte.contains("— Tailleur"))
        assertTrue(!texte.contains("0 F"))
    }

    @Test
    fun `le nom de fichier reste lisible et sans accent`() {
        assertEquals("fatou-sow-robe-ceremonie", nomFichier(cliente, commande))
        assertEquals(
            "commande",
            nomFichier(Client(nom = ""), commande.copy(modeleNom = "")),
        )
    }
}
