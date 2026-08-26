package com.essama.dresscode.metier

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/*
 * Les regles que l'utilisateur ne verifie jamais lui-meme : une
 * commande classee « calme » alors qu'elle est en retard ne se voit
 * pas a l'ecran, elle se voit quand la cliente rappelle.
 *
 * Ces tests tournent sur la machine de construction, sans emulateur :
 * c'est la boucle de retour la plus rapide du projet.
 */
class MoteurMetierTest {

    /* Date fixe : les echeances se fabriquent par decalage, pour que
       les tests n'expirent pas le lendemain de leur ecriture. */
    private val aujourdhui = LocalDate.of(2026, 8, 26)
    private fun dans(jours: Long): LocalDate = aujourdhui.plusDays(jours)

    private fun commande(
        id: Long = 1,
        statut: Statut = Statut.A_COMMENCER,
        cadence: Cadence = Cadence.NORMALE,
        livraison: LocalDate = dans(5),
        prixTotal: Long = 50_000,
        acompte: Long = 35_000,
        soldeRegle: Boolean = false,
    ) = Commande(
        id = id,
        clientId = 1,
        modeleNom = "Robe cérémonie",
        statut = statut,
        cadence = cadence,
        dateCommande = dans(-14),
        dateLivraison = livraison,
        prixTotal = prixTotal,
        acompte = acompte,
        soldeRegle = soldeRegle,
    )

    // ---------- Argent ----------

    @Test
    fun `un montant se lit avec un separateur de milliers insecable`() {
        assertEquals("85 000 F", montant(85_000))
        assertEquals("0 F", montant(0))
        assertEquals("1 250 000 F", montant(1_250_000))
    }

    @Test
    fun `le reste a payer se deduit du total et de l'acompte`() {
        assertEquals(15_000, commande().reste)
        assertEquals(0, commande(soldeRegle = true).reste)
        assertEquals(
            "un acompte superieur au total ne rend pas un reste negatif",
            0, commande(acompte = 60_000).reste,
        )
    }

    // ---------- Retard et anticipation ----------

    @Test
    fun `une livraison depassee passe en retard, jamais avant`() {
        assertFalse(commande(livraison = dans(1)).etat(aujourdhui).enRetard)
        assertFalse(
            "le jour meme n'est pas un retard",
            commande(livraison = dans(0)).etat(aujourdhui).enRetard,
        )
        assertTrue(commande(livraison = dans(-1)).etat(aujourdhui).enRetard)
        assertFalse(
            "une commande livree ne peut plus etre en retard",
            commande(livraison = dans(-3), statut = Statut.LIVREE).etat(aujourdhui).enRetard,
        )
    }

    @Test
    fun `la cadence decide seule du moment ou l'application dit de commencer`() {
        val jours = 4L
        assertFalse(commande(cadence = Cadence.RAPIDE, livraison = dans(jours)).etat(aujourdhui).aCommencer)
        assertFalse(commande(cadence = Cadence.NORMALE, livraison = dans(jours)).etat(aujourdhui).aCommencer)
        assertTrue(commande(cadence = Cadence.LONGUE, livraison = dans(jours)).etat(aujourdhui).aCommencer)
        assertTrue(commande(cadence = Cadence.RAPIDE, livraison = dans(1)).etat(aujourdhui).aCommencer)
    }

    @Test
    fun `une commande deja commencee ne redemande pas a etre commencee`() {
        assertFalse(
            commande(statut = Statut.EN_CONFECTION, livraison = dans(1)).etat(aujourdhui).aCommencer,
        )
    }

    // ---------- Resume du jour ----------

    @Test
    fun `une commande apparait dans un seul bloc du resume`() {
        val resume = resumeDuJour(
            listOf(
                commande(id = 1, livraison = dans(-2)),
                commande(id = 2, livraison = dans(0)),
                commande(id = 3, livraison = dans(1)),
                commande(id = 4, statut = Statut.EN_CONFECTION, livraison = dans(4)),
                commande(id = 5, statut = Statut.LIVREE, soldeRegle = true, livraison = dans(-9)),
            ),
            aujourdhui,
        )
        val placees = (resume.retard + resume.livraisons + resume.aCommencer +
            resume.enConfection + resume.pretes).map { it.commande.id }

        assertEquals(
            "une commande comptee deux fois fausse la lecture de l'ecran",
            placees.distinct(), placees,
        )
        assertEquals(listOf(1L), resume.retard.map { it.commande.id })
        assertEquals(listOf(2L), resume.livraisons.map { it.commande.id })
        assertEquals(listOf(3L), resume.aCommencer.map { it.commande.id })
    }

    @Test
    fun `les retards remontent du plus ancien au plus recent`() {
        val resume = resumeDuJour(
            listOf(
                commande(id = 1, livraison = dans(-1)),
                commande(id = 2, livraison = dans(-5)),
            ),
            aujourdhui,
        )
        assertEquals(listOf(2L, 1L), resume.retard.map { it.commande.id })
    }

    @Test
    fun `le total a encaisser suit les commandes livrees mais non soldees`() {
        val resume = resumeDuJour(
            listOf(
                commande(id = 1),
                commande(id = 2, statut = Statut.LIVREE, livraison = dans(-4), prixTotal = 45_000, acompte = 20_000),
                commande(id = 3, statut = Statut.LIVREE, soldeRegle = true),
            ),
            aujourdhui,
        )
        assertEquals(
            "un solde non regle reste du apres la livraison",
            40_000, resume.aEncaisser,
        )
        assertEquals(2, resume.nbImpayees)
    }

    @Test
    fun `une journee sans rien a faire se declare calme et n'alerte pas`() {
        val resume = resumeDuJour(
            listOf(commande(statut = Statut.EN_CONFECTION, cadence = Cadence.RAPIDE, livraison = dans(9))),
            aujourdhui,
        )
        assertTrue(resume.calme)
        assertNull("rien a dire ne declenche aucune notification", resume.texteRappel())
    }

    @Test
    fun `le rappel du matin annonce le retard avant le reste`() {
        val resume = resumeDuJour(
            listOf(
                commande(id = 1, livraison = dans(-2)),
                commande(id = 2, livraison = dans(0)),
            ),
            aujourdhui,
        )
        assertEquals("1 commande en retard, 1 à livrer", resume.texteRappel())
    }

    // ---------- Recherche ----------

    @Test
    fun `la recherche accepte le nom accentue et les quatre derniers chiffres`() {
        val cliente = Client(nom = "Aminata Kébé", telephone = "77 123 45 67")
        assertTrue(cliente.correspondA("kebe"))
        assertTrue(cliente.correspondA("KÉBÉ"))
        assertTrue(cliente.correspondA("4567"))
        assertTrue("une recherche vide ne filtre rien", cliente.correspondA("  "))
        assertFalse(cliente.correspondA("traore"))
        assertFalse("un seul chiffre est trop court pour filtrer", cliente.correspondA("9"))
    }

    // ---------- Mesures ----------

    @Test
    fun `des mesures de plus de six mois sont signalees a reprendre`() {
        fun ilYA(jours: Long) = aujourdhui.minusDays(jours)
            .atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()

        assertFalse(mesuresAnciennes(ilYA(30), aujourdhui))
        assertTrue(mesuresAnciennes(ilYA(200), aujourdhui))
        assertTrue("aucune mesure connue vaut mesures a prendre", mesuresAnciennes(null, aujourdhui))
    }

    @Test
    fun `les mesures se separent en base et supplementaires`() {
        assertEquals(6, Mesure.base.size)
        assertEquals(6, Mesure.supplementaires.size)
        assertEquals(Mesure.entries.size, Mesure.base.size + Mesure.supplementaires.size)
    }

    // ---------- Dates et formats ----------

    @Test
    fun `les dates se disent en francais, en casse de phrase`() {
        assertEquals("mercredi 26 août", dateLongue(aujourdhui))
        assertEquals("Mercredi 26 août", dateLongue(aujourdhui).majusculeInitiale())
        assertEquals("26 août 2026", dateCourte(aujourdhui))
        assertEquals("août 2026", moisAnnee(aujourdhui))
    }

    @Test
    fun `le delai dit le retard plutot que la date`() {
        assertEquals("aujourd’hui", delai(dans(0), aujourdhui))
        assertEquals("demain", delai(dans(1), aujourdhui))
        assertEquals("dans 3 jours", delai(dans(3), aujourdhui))
        assertEquals(
            "« hier » ne dirait pas le retard dans une liste",
            "1 jour de retard", delai(dans(-1), aujourdhui),
        )
        assertEquals("2 jours de retard", delai(dans(-2), aujourdhui))
    }

    @Test
    fun `un changement d'heure ne decale pas le comptage des jours`() {
        val debut = LocalDate.of(2026, 3, 28)
        val fin = LocalDate.of(2026, 3, 30)
        assertEquals(2, java.time.temporal.ChronoUnit.DAYS.between(debut, fin))
    }

    // ---------- Statuts ----------

    @Test
    fun `chaque statut sait lequel le suit, et le dernier ne suit rien`() {
        assertEquals(Statut.EN_CONFECTION, Statut.A_COMMENCER.suivant)
        assertEquals(Statut.PRETE, Statut.EN_CONFECTION.suivant)
        assertEquals(Statut.LIVREE, Statut.PRETE.suivant)
        assertNull(Statut.LIVREE.suivant)
    }

    @Test
    fun `chaque cadence anticipe d'au moins un jour`() {
        Cadence.entries.forEach { assertTrue(it.anticipationJours >= 1) }
    }
}
