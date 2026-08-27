package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavHostController
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.Ligne
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.delai
import com.essama.dresscode.metier.etat
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.EtatVide
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Route
import com.essama.dresscode.ui.Vignette

/*
 * Les filtres reprennent exactement les blocs d'« Aujourd'hui » :
 * appuyer sur « 2 commandes en retard » doit amener sur ces deux
 * commandes-la, pas sur une liste ou il faut les rechercher.
 */

private data class Filtre(
    val cle: String,
    val libelle: String,
    val garde: (Ligne) -> Boolean,
)

private val filtres = listOf(
    Filtre("en_cours", "En cours") { it.commande.statut != Statut.LIVREE },
    Filtre("retard", "En retard") { it.etat.enRetard },
    Filtre("aujourdhui", "Aujourd’hui") { it.etat.livraisonAujourdhui },
    Filtre("a_commencer", Statut.A_COMMENCER.libelle) { it.commande.statut == Statut.A_COMMENCER },
    Filtre("en_confection", Statut.EN_CONFECTION.libelle) { it.commande.statut == Statut.EN_CONFECTION },
    Filtre("prete", Statut.PRETE.libelle) { it.commande.statut == Statut.PRETE },
    Filtre("impayees", "Impayées") { it.etat.reste > 0 },
    Filtre("historique", "Historique") { it.commande.statut == Statut.LIVREE },
    Filtre("toutes", "Toutes") { true },
)

@Composable
fun EcranCommandes(
    modeleVue: ModeleVue,
    navigation: NavHostController,
    filtreInitial: String,
) {
    val commandes by modeleVue.commandes.collectAsState()
    val clients by modeleVue.clients.collectAsState()
    var choisi by remember { mutableStateOf(filtreInitial) }

    val lignes = commandes.map { Ligne(it, it.etat()) }
    val filtre = filtres.firstOrNull { it.cle == choisi } ?: filtres.first()

    /* Le plus urgent en haut, toujours : une liste triee par date de
       creation obligerait a la parcourir en entier pour trouver ce
       qui brule. */
    val visibles = if (filtre.cle == "historique") {
        /* L'historique se lit a l'envers du reste : ce qu'on cherche,
           c'est la derniere robe faite pour cette cliente, pas la
           premiere de l'annee. */
        lignes.filter(filtre.garde)
            .sortedWith(
                compareByDescending<Ligne> { it.commande.dateLivraison }
                    .thenByDescending { it.commande.livreeLe ?: 0L },
            )
    } else {
        lignes.filter(filtre.garde)
            .sortedWith(
                compareBy<Ligne> { if (it.commande.statut == Statut.LIVREE) 1 else 0 }
                    .thenBy { it.etat.joursRestants },
            )
    }

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.quatre, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.trois),
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(bottom = Espace.deux),
                horizontalArrangement = Arrangement.spacedBy(Espace.deux),
            ) {
                filtres.forEach { candidat ->
                    val nombre = lignes.count(candidat.garde)
                    FilterChip(
                        selected = candidat.cle == choisi,
                        onClick = { choisi = candidat.cle },
                        label = {
                            Text(
                                if (nombre > 0) "${candidat.libelle}  $nombre" else candidat.libelle,
                            )
                        },
                    )
                }
            }
        }

        if (visibles.isEmpty()) {
            item {
                EtatVide(icone = Icones.Checkroom, titre = messageVide(filtre.cle))
            }
        }

        items(visibles, key = { it.commande.id }) { ligne ->
            val client = clients.firstOrNull { it.id == ligne.commande.clientId }
            val photo = ligne.commande.photo?.let { modeleVue.depot.photos.fichier(it) }
            CarteLien(
                titre = ligne.commande.modeleNom,
                detail = listOfNotNull(
                    client?.nom ?: "Cliente supprimée",
                    /* La photo remplace la pastille : le statut, qu'elle
                       portait, revient ici en toutes lettres. */
                    if (photo != null) ligne.commande.statut.libelle else null,
                    if (ligne.etat.reste > 0) "reste ${montant(ligne.etat.reste)}" else null,
                ).joinToString(" · "),
                debut = {
                    Vignette(
                        fichier = photo,
                        description = ligne.commande.modeleNom,
                    ) { JetonStatut(ligne.commande.statut) }
                },
                fin = { Echeance(ligne) },
                surClic = { navigation.navigate(Route.commande(ligne.commande.id)) },
            )
        }
    }
}

/* La couleur seule ne dit rien : l'icone porte le sens, et le
   libelle complet est sur la fiche. */
@Composable
private fun JetonStatut(statut: Statut) {
    val fond = when (statut) {
        Statut.A_COMMENCER -> MaterialTheme.colorScheme.surfaceVariant
        Statut.EN_CONFECTION -> MaterialTheme.colorScheme.secondaryContainer
        Statut.PRETE -> MaterialTheme.colorScheme.primaryContainer
        Statut.LIVREE -> MaterialTheme.colorScheme.tertiaryContainer
    }
    val encre = when (statut) {
        Statut.A_COMMENCER -> MaterialTheme.colorScheme.onSurfaceVariant
        Statut.EN_CONFECTION -> MaterialTheme.colorScheme.onSecondaryContainer
        Statut.PRETE -> MaterialTheme.colorScheme.onPrimaryContainer
        Statut.LIVREE -> MaterialTheme.colorScheme.onTertiaryContainer
    }
    Box(
        modifier = Modifier.size(40.dp).background(fond, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        IconeSymbole(icone = iconeDe(statut), taille = Taille.petite, couleur = encre)
    }
}

@Composable
private fun Echeance(ligne: Ligne) {
    val couleur: Color = when {
        ligne.commande.statut == Statut.LIVREE -> MaterialTheme.colorScheme.onSurfaceVariant
        ligne.etat.enRetard -> MaterialTheme.colorScheme.error
        ligne.etat.livraisonAujourdhui || ligne.etat.aCommencer -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Text(
        text = if (ligne.commande.statut == Statut.LIVREE) {
            "Livrée"
        } else {
            delai(ligne.commande.dateLivraison)
        },
        style = MaterialTheme.typography.labelLarge,
        color = couleur,
    )
}

internal fun iconeDe(statut: Statut) = when (statut) {
    Statut.A_COMMENCER -> Icones.ContentCut
    Statut.EN_CONFECTION -> Icones.Iron
    Statut.PRETE -> Icones.CheckCircle
    Statut.LIVREE -> Icones.Inventory2
}

private fun messageVide(filtre: String) = when (filtre) {
    "en_cours" -> "Aucune commande en cours."
    "retard" -> "Aucun retard."
    "aujourdhui" -> "Aucune livraison aujourd’hui."
    "impayees" -> "Tout est encaissé."
    "historique" -> "Aucune commande livrée pour le moment."
    "toutes" -> "Aucune commande enregistrée."
    else -> "Aucune commande à ce stade."
}
