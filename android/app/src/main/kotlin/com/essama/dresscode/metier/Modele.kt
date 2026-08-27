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
 *
 * Ces douze-la sont celles que tout le monde prend. Elles ne sont pas
 * la liste complete : un carnet de papier n'en a pas, et le couturier
 * ajoute les siennes — « tour de tete » pour un boubou, « hauteur de
 * pince » pour une robe cintree. D'ou des mesures rangees par clef
 * texte plutot que par cette enumeration : le nom d'une constante
 * ici, le libelle ecrit a la main sinon.
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

    /** La clef sous laquelle cette mesure est rangee et enregistree. */
    val cle: String get() = name

    companion object {
        val base get() = entries.filter { it.deBase }
        val supplementaires get() = entries.filterNot { it.deBase }

        fun parCle(cle: String): Mesure? = entries.find { it.name == cle }
    }
}

/**
 * Le libelle a afficher pour une clef de mesure : celui de
 * l'enumeration quand elle en fait partie, la clef elle-meme quand
 * c'est le couturier qui l'a nommee.
 */
fun libelleMesure(cle: String): String = Mesure.parCle(cle)?.libelle ?: cle

/**
 * Une clef de mesure ecrite a la main. Le point-virgule et le signe
 * egal separent les mesures a l'enregistrement : les laisser passer
 * couperait la fiche en deux a la relecture.
 */
fun cleLibre(libelle: String): String =
    libelle.replace(Regex("[;=]"), " ").trim().replace(Regex("\\s+"), " ")

/** Les douze d'abord, dans l'ordre du metier ; les autres ensuite. */
fun mesuresOrdonnees(mesures: Map<String, String>): List<Pair<String, String>> {
    val standard = Mesure.entries.mapNotNull { m ->
        mesures[m.cle]?.takeIf { it.isNotBlank() }?.let { m.cle to it }
    }
    val libres = mesures.entries
        .filter { Mesure.parCle(it.key) == null && it.value.isNotBlank() }
        .map { it.key to it.value }
    return standard + libres
}

data class Client(
    val id: Long = 0,
    val nom: String,
    val telephone: String = "",
    val mesures: Map<String, String> = emptyMap(),
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
    val mesures: Map<String, String> = emptyMap(),
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
