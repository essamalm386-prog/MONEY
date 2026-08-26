package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Mesure
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.anciennete
import com.essama.dresscode.metier.delai
import com.essama.dresscode.metier.mesuresAnciennes
import com.essama.dresscode.metier.moisAnnee
import com.essama.dresscode.metier.montant
import com.essama.dresscode.partage.Partage
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.EtatVide
import com.essama.dresscode.ui.LigneInfo
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Pastille
import com.essama.dresscode.ui.Route

/*
 * Trois choses comptent, dans cet ordre :
 *   — Les mesures d'abord, avec leur date. Le couturier voit tout de
 *     suite s'il doit remesurer ou non.
 *   — Les anciens modeles. « Je vous refais le meme que l'an
 *     dernier ? » — et on le lui montre.
 *   — Une nouvelle commande qui part de la fiche : les mesures sont
 *     deja la, il ne reste que le modele, la date et le prix.
 */
@Composable
fun EcranClient(
    modeleVue: ModeleVue,
    navigation: NavHostController,
    clientId: Long,
    message: (String) -> Unit,
) {
    val contexte = LocalContext.current
    val fiche by modeleVue.fiche(clientId).collectAsState(initial = Triple(null, emptyList(), null))
    val (client, commandes, envoi) = fiche

    if (client == null) {
        EtatVide(icone = Icones.Group, titre = "Cliente introuvable.")
        return
    }

    val enCours = commandes.filter { it.statut != Statut.LIVREE }
        .sortedBy { it.dateLivraison }
    val passees = commandes.filter { it.statut == Statut.LIVREE }
        .sortedByDescending { it.livreeLe ?: 0 }
    val du = commandes.sumOf { it.reste }
    val remplies = Mesure.entries.filter { client.mesures[it]?.isNotBlank() == true }

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.six, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Espace.quatre),
            ) {
                Pastille(client.nom, taille = 56)
                Column(modifier = Modifier.weight(1f)) {
                    Text(client.nom, style = MaterialTheme.typography.headlineSmall)
                    Text(
                        client.telephone.ifBlank { "Numéro non renseigné" },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(Espace.trois)) {
                if (client.telephone.isNotBlank()) {
                    OutlinedButton(
                        onClick = { contexte.startActivity(Partage(contexte).appeler(client.telephone)) },
                    ) {
                        IconeSymbole(icone = Icones.Call, taille = Taille.petite)
                        Text("  Appeler")
                    }
                }
                Button(onClick = { navigation.navigate(Route.nouvelleCommande(client.id)) }) {
                    IconeSymbole(icone = Icones.Add, taille = Taille.petite)
                    Text("  Nouvelle commande")
                }
            }
        }

        if (du > 0) {
            item {
                Text(
                    "${montant(du)} à encaisser sur " +
                        "${commandes.count { it.reste > 0 }} commande" +
                        if (commandes.count { it.reste > 0 } > 1) "s" else "",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        item { SousTitre("Mesures") }
        if (remplies.isEmpty()) {
            item {
                Text(
                    "Aucune mesure enregistrée.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            item {
                val vieilles = mesuresAnciennes(client.mesuresMajLe)
                Text(
                    "Mises à jour ${anciennete(client.mesuresMajLe)}" +
                        if (vieilles) " — à revérifier" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (vieilles) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
            items(remplies) { mesure ->
                LigneInfo(mesure.libelle, "${client.mesures[mesure]} cm")
            }
        }

        if (enCours.isNotEmpty()) {
            item { SousTitre("En cours") }
            items(enCours, key = { it.id }) { commande ->
                CarteLien(
                    titre = commande.modeleNom,
                    detail = listOfNotNull(
                        delai(commande.dateLivraison),
                        if (commande.reste > 0) "reste ${montant(commande.reste)}" else null,
                    ).joinToString(" · "),
                    surClic = { navigation.navigate(Route.commande(commande.id)) },
                )
            }
        }

        if (passees.isNotEmpty()) {
            item { SousTitre("Historique — ${passees.size} commande${if (passees.size > 1) "s" else ""}") }
            items(passees, key = { it.id }) { commande ->
                CarteLien(
                    titre = commande.modeleNom,
                    detail = "${moisAnnee(commande.dateLivraison)} · ${montant(commande.prixTotal)}",
                    surClic = { navigation.navigate(Route.commande(commande.id)) },
                )
            }
        }

        if (commandes.isEmpty()) {
            item {
                EtatVide(icone = Icones.Checkroom, titre = "Aucune commande pour cette cliente.")
            }
        }

        /* Une ligne, pas un historique de conversation : elle sert a
           une seule chose, savoir qu'il faut relancer. */
        if (envoi != null) {
            item {
                Text(
                    text = if (envoi.type == "modeles") {
                        "${envoi.nombre} modèle${if (envoi.nombre > 1) "s" else ""} " +
                            "envoyé${if (envoi.nombre > 1) "s" else ""} ${anciennete(envoi.le)}"
                    } else {
                        "Fiche envoyée ${anciennete(envoi.le)}"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun SousTitre(texte: String) {
    Text(
        text = texte,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(top = Espace.quatre),
    )
}
