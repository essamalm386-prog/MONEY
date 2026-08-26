package com.essama.dresscode.metier

import java.time.LocalDate

/*
 * Le vocabulaire du metier, et rien de plus.
 *
 * Le principe reste celui du cahier :
 *   Cliente -> Mesures -> Modele -> Commande -> Livraison -> Rappel
 * Pas de comptabilite, pas de stock, pas de facturation.
 */

/**
 * Quatre statuts, et rien de plus. Pas de sous-etape, pas de
 * pourcentage d'avancement : le couturier connait son metier, il a
 * besoin de savoir ou en est chaque commande vis-a-vis de la
 * livraison, pas de documenter son processus.
 */
enum class Statut(val libelle: String) {
    A_COMMENCER("À commencer"),
    EN_CONFECTION("En confection"),
    PRETE("Prête"),
    LIVREE("Livrée"),
    ;

    /** Le statut suivant, ou null pour le dernier. */
    val suivant: Statut?
        get() = entries.getOrNull(ordinal + 1)

    /** Le libelle du bouton qui fait avancer vers ce statut. */
    val actionPourAtteindre: String
        get() = when (this) {
            A_COMMENCER -> "Reprendre"
            EN_CONFECTION -> "Commencer"
            PRETE -> "Marquer prête"
            LIVREE -> "Marquer livrée"
        }
}

/**
 * Un ourlet ne se previent pas cinq jours a l'avance, un costume
 * trois pieces si. Le couturier choisit une seule fois, a la
 * creation de la commande.
 */
enum class Cadence(
    val libelle: String,
    val exemple: String,
    val anticipationJours: Long,
) {
    RAPIDE("Rapide", "ourlet, retouche", 1),
    NORMALE("Normale", "robe, chemise", 3),
    LONGUE("Longue", "costume, tenue de mariage", 6),
}

enum class Categorie(val libelle: String) {
    FEMME("Femme"),
    HOMME("Homme"),
    ENFANT("Enfant"),
}

/**
 * Six mesures de base, six de plus derriere une divulgation
 * progressive : afficher douze champs d'un coup ferait fuir.
 */
enum class Mesure(val libelle: String, val deBase: Boolean) {
    POITRINE("Poitrine", true),
    TAILLE("Taille", true),
    HANCHES("Hanches", true),
    EPAULE("Épaule", true),
    MANCHE("Manche", true),
    LONGUEUR("Longueur", true),
    COU("Cou", false),
    BRAS("Tour de bras", false),
    POIGNET("Poignet", false),
    CEINTURE("Ceinture", false),
    CUISSE("Cuisse", false),
    ENTREJAMBE("Entrejambe", false),
    ;

    companion object {
        val base get() = entries.filter { it.deBase }
        val supplementaires get() = entries.filterNot { it.deBase }
    }
}

data class Client(
    val id: Long = 0,
    val nom: String,
    val telephone: String = "",
    val mesures: Map<Mesure, String> = emptyMap(),
    val mesuresMajLe: Long? = null,
    val creeLe: Long = 0,
)

data class ModeleCatalogue(
    val id: Long = 0,
    val nom: String,
    val categorie: Categorie? = null,
    val prixIndicatif: Long = 0,
    val photo: String? = null,
    val creeLe: Long = 0,
)

data class Commande(
    val id: Long = 0,
    val clientId: Long,
    val modeleNom: String,
    val modeleId: Long? = null,
    val photo: String? = null,
    val mesures: Map<Mesure, String> = emptyMap(),
    val cadence: Cadence = Cadence.NORMALE,
    val statut: Statut = Statut.A_COMMENCER,
    val dateCommande: LocalDate,
    val dateLivraison: LocalDate,
    val prixTotal: Long = 0,
    val acompte: Long = 0,
    val soldeRegle: Boolean = false,
    val recapEnvoyeLe: Long? = null,
    val livreeLe: Long? = null,
) {
    /**
     * Le solde reste du au couturier tant qu'il n'a pas ete encaisse,
     * meme apres livraison. C'est tout l'interet par rapport au
     * cahier : personne ne fait l'addition a la main, donc personne
     * ne reclame.
     */
    val reste: Long
        get() = if (soldeRegle) 0 else (prixTotal - acompte).coerceAtLeast(0)
}

data class Atelier(
    val nom: String = "",
    val telephone: String = "",
    val adresse: String = "",
    val indicatif: String = "221",
    val heureRappel: Int = 7,
    val rappelActif: Boolean = true,
)
