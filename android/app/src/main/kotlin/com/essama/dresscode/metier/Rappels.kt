package com.essama.dresscode.metier

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/*
 * Le renversement par rapport au cahier tient ici : le couturier ne
 * saisit qu'une date, celle promise a la cliente. Tout le reste —
 * quand commencer, quand s'inquieter, ce qui est en retard — se
 * deduit de cette date et de la cadence du vetement. Aucune alerte a
 * programmer a la main.
 *
 * Tout se compare en jours calendaires locaux : comparer des
 * horodatages ferait basculer une livraison « aujourd'hui » en « en
 * retard » a la seconde ou l'heure de saisie est depassee.
 */

enum class Urgence { RETARD, BIENTOT, CALME }

data class Etat(
    val joursRestants: Long,
    val enRetard: Boolean,
    val livraisonAujourdhui: Boolean,
    val aCommencer: Boolean,
    val reste: Long,
    val urgence: Urgence,
)

fun Commande.etat(aujourdhui: LocalDate = LocalDate.now()): Etat {
    val restants = ChronoUnit.DAYS.between(aujourdhui, dateLivraison)
    val livree = statut == Statut.LIVREE
    val enRetard = !livree && restants < 0
    val livraisonAujourdhui = !livree && restants == 0L
    val aCommencer = statut == Statut.A_COMMENCER && restants <= cadence.anticipationJours

    return Etat(
        joursRestants = restants,
        enRetard = enRetard,
        livraisonAujourdhui = livraisonAujourdhui,
        aCommencer = aCommencer,
        reste = reste,
        urgence = when {
            enRetard -> Urgence.RETARD
            livraisonAujourdhui || aCommencer -> Urgence.BIENTOT
            else -> Urgence.CALME
        },
    )
}

/** Une commande et son etat, pour ne calculer ce dernier qu'une fois. */
data class Ligne(val commande: Commande, val etat: Etat)

/**
 * Ce que l'ecran d'accueil affiche. L'ecran doit se lire en trois
 * secondes : les commandes arrivent deja triees par urgence pour que
 * le premier regard tombe sur ce qui brule.
 */
data class ResumeDuJour(
    val retard: List<Ligne> = emptyList(),
    val livraisons: List<Ligne> = emptyList(),
    val aCommencer: List<Ligne> = emptyList(),
    val enConfection: List<Ligne> = emptyList(),
    val pretes: List<Ligne> = emptyList(),
    val aEncaisser: Long = 0,
    val nbImpayees: Int = 0,
    val enCours: Int = 0,
) {
    val calme: Boolean
        get() = retard.isEmpty() && aCommencer.isEmpty() && livraisons.isEmpty()
}

fun resumeDuJour(
    commandes: List<Commande>,
    aujourdhui: LocalDate = LocalDate.now(),
): ResumeDuJour {
    val lignes = commandes.map { Ligne(it, it.etat(aujourdhui)) }

    /*
     * Chaque commande tombe dans un bloc et un seul, par ordre
     * d'urgence decroissant. Sans cette exclusivite, une robe promise
     * pour aujourd'hui et pas encore commencee apparaitrait deux fois
     * sur l'ecran, et le couturier compterait deux commandes la ou il
     * n'y en a qu'une.
     */
    val retard = mutableListOf<Ligne>()
    val livraisons = mutableListOf<Ligne>()
    val aCommencer = mutableListOf<Ligne>()
    val enConfection = mutableListOf<Ligne>()
    val pretes = mutableListOf<Ligne>()

    for (ligne in lignes) {
        when {
            ligne.etat.enRetard -> retard
            ligne.etat.livraisonAujourdhui -> livraisons
            ligne.etat.aCommencer -> aCommencer
            ligne.commande.statut == Statut.EN_CONFECTION -> enConfection
            ligne.commande.statut == Statut.PRETE -> pretes
            else -> null
        }?.add(ligne)
    }

    /* Le plus en retard d'abord, puis l'echeance la plus proche. */
    val parEcheance = compareBy<Ligne> { it.etat.joursRestants }
    val impayees = commandes.filter { it.reste > 0 }

    return ResumeDuJour(
        retard = retard.sortedWith(parEcheance),
        livraisons = livraisons.sortedWith(parEcheance),
        aCommencer = aCommencer.sortedWith(parEcheance),
        enConfection = enConfection.sortedWith(parEcheance),
        pretes = pretes.sortedWith(parEcheance),
        aEncaisser = impayees.sumOf { it.reste },
        nbImpayees = impayees.size,
        enCours = commandes.count { it.statut != Statut.LIVREE },
    )
}

/**
 * Le texte que l'application pousse le matin. Une notification par
 * jour au maximum : une application qui vibre huit fois dans la
 * journee est desinstallee dans la semaine. Rend null quand il n'y a
 * rien a dire — une journee calme ne declenche aucune notification.
 */
fun ResumeDuJour.texteRappel(): String? {
    if (retard.isNotEmpty()) {
        val debut = if (retard.size == 1) "1 commande en retard" else "${retard.size} commandes en retard"
        return if (livraisons.isEmpty()) debut else "$debut, ${livraisons.size} à livrer"
    }
    val morceaux = buildList {
        if (livraisons.isNotEmpty()) add("${livraisons.size} à livrer")
        if (aCommencer.isNotEmpty()) add("${aCommencer.size} à commencer")
    }
    return morceaux.takeIf { it.isNotEmpty() }?.joinToString(", ")
}
