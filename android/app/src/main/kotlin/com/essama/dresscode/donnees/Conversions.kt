package com.essama.dresscode.donnees

import com.essama.dresscode.metier.Cadence
import com.essama.dresscode.metier.Categorie
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.Mesure
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.Statut
import java.time.LocalDate

/*
 * Passage entre le schema de la base et le vocabulaire du metier.
 *
 * Le moteur metier ignore Room : c'est ce qui permet de le compiler
 * et de le tester sans Android, et donc de verifier en quelques
 * secondes les regles qui comptent le plus.
 */

/** « poitrine=92;taille=74 » — assez pour une douzaine de mesures. */
internal fun Map<Mesure, String>.serialiser(): String =
    entries.filter { it.value.isNotBlank() }
        .joinToString(";") { "${it.key.name}=${it.value}" }

internal fun String.enMesures(): Map<Mesure, String> =
    split(";")
        .filter { it.isNotBlank() }
        .mapNotNull { morceau ->
            val (cle, valeur) = morceau.split("=", limit = 2).let {
                if (it.size == 2) it[0] to it[1] else return@mapNotNull null
            }
            /* Une mesure retiree du code ne doit pas faire planter la
               lecture d'une fiche enregistree avant. */
            runCatching { Mesure.valueOf(cle) }.getOrNull()?.let { it to valeur }
        }
        .toMap()

fun ClientEntite.versMetier() = Client(
    id = id,
    nom = nom,
    telephone = telephone,
    mesures = mesures.enMesures(),
    mesuresMajLe = mesuresMajLe,
    creeLe = creeLe,
)

fun Client.versEntite(majLe: Long = System.currentTimeMillis()) = ClientEntite(
    id = id,
    nom = nom,
    telephone = telephone,
    mesures = mesures.serialiser(),
    mesuresMajLe = mesuresMajLe,
    creeLe = if (creeLe == 0L) majLe else creeLe,
    majLe = majLe,
)

fun ModeleEntite.versMetier() = ModeleCatalogue(
    id = id,
    nom = nom,
    categorie = categorie?.let { nom -> runCatching { Categorie.valueOf(nom) }.getOrNull() },
    prixIndicatif = prixIndicatif,
    photo = photo,
    creeLe = creeLe,
)

fun ModeleCatalogue.versEntite() = ModeleEntite(
    id = id,
    nom = nom,
    categorie = categorie?.name,
    prixIndicatif = prixIndicatif,
    photo = photo,
    creeLe = if (creeLe == 0L) System.currentTimeMillis() else creeLe,
)

fun CommandeEntite.versMetier() = Commande(
    id = id,
    clientId = clientId,
    modeleNom = modeleNom,
    modeleId = modeleId,
    photo = photo,
    mesures = mesures.enMesures(),
    cadence = runCatching { Cadence.valueOf(cadence) }.getOrDefault(Cadence.NORMALE),
    statut = runCatching { Statut.valueOf(statut) }.getOrDefault(Statut.A_COMMENCER),
    dateCommande = LocalDate.parse(dateCommande),
    dateLivraison = LocalDate.parse(dateLivraison),
    prixTotal = prixTotal,
    acompte = acompte,
    soldeRegle = soldeRegle,
    recapEnvoyeLe = recapEnvoyeLe,
    livreeLe = livreeLe,
)

fun Commande.versEntite(majLe: Long = System.currentTimeMillis()) = CommandeEntite(
    id = id,
    clientId = clientId,
    modeleNom = modeleNom,
    modeleId = modeleId,
    photo = photo,
    mesures = mesures.serialiser(),
    cadence = cadence.name,
    statut = statut.name,
    dateCommande = dateCommande.toString(),
    dateLivraison = dateLivraison.toString(),
    prixTotal = prixTotal,
    acompte = acompte,
    soldeRegle = soldeRegle,
    recapEnvoyeLe = recapEnvoyeLe,
    livreeLe = livreeLe,
    majLe = majLe,
)
