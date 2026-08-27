package com.essama.dresscode.metier

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.Locale

/*
 * Typographie francaise. Les regles Material sont pensees pour
 * l'anglais ; le francais impose les siennes, et elles se voient :
 * un montant coupe en fin de ligne ou un mois avec une majuscule
 * parasite trahissent une application traduite a la va-vite.
 */

/** Espace insecable : un montant ne doit jamais se couper. */
private const val INSECABLE = ' '

private val JOURS = listOf(
    "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
)
private val MOIS = listOf(
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
)

fun nombreSepare(valeur: Long): String {
    val chiffres = valeur.coerceAtLeast(0).toString()
    return chiffres.reversed()
        .chunked(3)
        .joinToString(INSECABLE.toString())
        .reversed()
}

fun montant(valeur: Long): String = "${nombreSepare(valeur)}${INSECABLE}F"

/** « mercredi 26 août » */
fun dateLongue(date: LocalDate): String =
    "${JOURS[date.dayOfWeek.value - 1]} ${date.dayOfMonth} ${MOIS[date.monthValue - 1]}"

/** « 26 août 2026 » */
fun dateCourte(date: LocalDate): String =
    "${date.dayOfMonth} ${MOIS[date.monthValue - 1]} ${date.year}"

/** « août 2026 » */
fun moisAnnee(date: LocalDate): String =
    "${MOIS[date.monthValue - 1]} ${date.year}"

/**
 * Le couturier raisonne en delai, pas en date absolue.
 * « hier » serait exact pour une livraison depassee d'un jour, mais
 * ne dirait pas le retard : dans une liste, c'est le retard qui doit
 * sauter aux yeux.
 */
fun delai(date: LocalDate, aujourdhui: LocalDate = LocalDate.now()): String {
    val restants = ChronoUnit.DAYS.between(aujourdhui, date)
    return when {
        restants == 0L -> "aujourd’hui"
        restants == 1L -> "demain"
        restants > 1L -> "dans $restants jours"
        restants == -1L -> "1 jour de retard"
        else -> "${-restants} jours de retard"
    }
}

fun anciennete(horodatage: Long?, aujourdhui: LocalDate = LocalDate.now()): String {
    if (horodatage == null) return ""
    val date = java.time.Instant.ofEpochMilli(horodatage)
        .atZone(java.time.ZoneId.systemDefault()).toLocalDate()
    val jours = ChronoUnit.DAYS.between(date, aujourdhui)
    return when {
        jours <= 0 -> "aujourd’hui"
        jours == 1L -> "hier"
        jours < 30 -> "il y a $jours jours"
        jours < 730 -> "il y a ${Math.round(jours / 30.0)} mois"
        else -> "il y a ${Math.round(jours / 365.0)} ans"
    }
}

/**
 * Une mesure de plus de six mois merite une reprise : c'est ce que le
 * couturier verifie d'abord quand une cliente revient.
 */
fun mesuresAnciennes(majLe: Long?, aujourdhui: LocalDate = LocalDate.now()): Boolean {
    if (majLe == null) return true
    val date = java.time.Instant.ofEpochMilli(majLe)
        .atZone(java.time.ZoneId.systemDefault()).toLocalDate()
    return ChronoUnit.DAYS.between(date, aujourdhui) > 180
}

/** Casse de phrase : « Mercredi 26 août », jamais « Mercredi 26 Août ». */
fun String.majusculeInitiale(): String =
    if (isEmpty()) this else this[0].uppercaseChar() + substring(1)

/*
 * Recherche. Les accents sont neutralises : personne ne tape
 * « Aminata Kébé » avec le bon accent sur un clavier de telephone.
 */

fun normaliser(texte: String): String =
    java.text.Normalizer.normalize(texte, java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .lowercase(Locale.FRENCH)
        .trim()

fun chiffresSeuls(texte: String): String = texte.filter { it.isDigit() }

/** Un nom, ou les quatre derniers chiffres d'un numero. */
fun Client.correspondA(requete: String): Boolean {
    val q = normaliser(requete)
    if (q.isEmpty()) return true
    if (normaliser(nom).contains(q)) return true
    val qChiffres = chiffresSeuls(requete)
    return qChiffres.length >= 2 && chiffresSeuls(telephone).contains(qChiffres)
}
