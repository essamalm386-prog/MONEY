package com.essama.dresscode.partage

import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.montant
import com.essama.dresscode.metier.normaliser

/*
 * Les textes qui accompagnent un envoi, et la mise en forme des
 * numeros. Aucune dependance Android : ces regles se verifient donc
 * en quelques secondes avec outils/verifier-metier-kotlin.sh, sans
 * emulateur.
 */

/**
 * Le meme recapitulatif ressert trois fois : a la commande, quand le
 * vetement est pret, et a la livraison comme recu — celui que
 * l'artisan ne donnait jamais.
 */
enum class Variante(val titre: String, val pied: String) {
    COMMANDE("Récapitulatif de commande", "Merci de votre confiance"),
    PRETE("Votre vêtement est prêt", "À récupérer à l’atelier"),
    LIVREE("Reçu", "Soldé — merci"),
}

/**
 * wa.me attend un numero international sans signe ni espace.
 * L'indicatif de l'atelier comble les numeros notes en local, qui
 * sont la quasi-totalite des numeros d'un carnet de quartier.
 */
fun numeroInternational(telephone: String, indicatif: String): String {
    val brut = telephone.filter { it.isDigit() || it == '+' }
    if (brut.isEmpty()) return ""
    if (brut.startsWith("+")) return brut.drop(1)
    if (brut.startsWith("00")) return brut.drop(2)
    val prefixe = indicatif.filter { it.isDigit() }
    if (prefixe.isEmpty() || brut.startsWith(prefixe)) return brut
    return "$prefixe$brut"
}

// ---------- Textes d'accompagnement ----------

fun texteRecapitulatif(
    atelier: Atelier,
    client: Client,
    commande: Commande,
    variante: Variante,
): String {
    val prenom = client.nom.substringBefore(' ')
    val signature = listOf(atelier.nom, atelier.telephone)
        .filter { it.isNotBlank() }
        .joinToString(" — ")

    return when (variante) {
        Variante.PRETE -> listOfNotNull(
            /* Le nom du modele est du texte libre : « votre Robe est
               prêt » serait faux, « prête » le serait tout autant sur
               un boubou. On tourne la phrase pour n'accorder que sur
               « commande ». */
            "Bonjour $prenom, votre commande est prête : ${commande.modeleNom}.",
            if (commande.reste > 0) "Reste à régler : ${montant(commande.reste)}." else null,
            signature.ifBlank { null },
        ).joinToString("\n")

        Variante.LIVREE -> listOfNotNull(
            "Bonjour $prenom, voici votre reçu pour ${commande.modeleNom}.",
            signature.ifBlank { null },
        ).joinToString("\n")

        Variante.COMMANDE -> listOfNotNull(
            "Bonjour $prenom, voici le récapitulatif de votre commande.",
            signature.ifBlank { null },
        ).joinToString("\n")
    }
}

fun texteModeles(
    atelier: Atelier,
    client: Client?,
    modeles: List<ModeleCatalogue>,
): String {
    val prenom = client?.nom?.substringBefore(' ')
    val lignes = modeles.map { modele ->
        val prix = if (modele.prixIndicatif > 0) ", à partir de ${montant(modele.prixIndicatif)}" else ""
        "— ${modele.nom}$prix"
    }
    return (
        listOf(
            if (prenom != null) "Bonjour $prenom, voici les modèles dont nous avons parlé."
            else "Voici quelques modèles.",
        ) + lignes + listOfNotNull(
            listOf(atelier.nom, atelier.telephone)
                .filter { it.isNotBlank() }
                .joinToString(" — ")
                .ifBlank { null },
        )
        ).joinToString("\n")
}

/** Nom de fichier lisible : « fatou-sow-robe-ceremonie ». */
fun nomFichier(client: Client, commande: Commande): String {
    fun propre(texte: String) = normaliser(texte)
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
    return listOf(propre(client.nom), propre(commande.modeleNom))
        .filter { it.isNotEmpty() }
        .joinToString("-")
        .ifEmpty { "commande" }
}
