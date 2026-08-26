package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.navigation.NavHostController
import coil.compose.AsyncImage
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Mesure
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.dateLongue
import com.essama.dresscode.metier.delai
import com.essama.dresscode.metier.etat
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.LigneInfo
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Route

/*
 * Deux gestes dominent : faire avancer le statut, et envoyer la
 * fiche a la cliente. Ils sont donc les deux plus gros boutons. Le
 * reste — mesures, argent, detail — se lit sans agir.
 */
@Composable
fun EcranCommande(
    modeleVue: ModeleVue,
    navigation: NavHostController,
    commandeId: Long,
    message: (String) -> Unit,
) {
    val commande by modeleVue.commande(commandeId).collectAsState(initial = null)
    val clients by modeleVue.clients.collectAsState()
    val courante = commande ?: return

    val client = clients.firstOrNull { it.id == courante.clientId }
    val situation = courante.etat()
    val suivant = courante.statut.suivant

    var demandeSolde by remember { mutableStateOf(false) }
    var demandeSuppression by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.six, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        if (courante.photo != null) {
            item {
                AsyncImage(
                    model = modeleVue.depot.photos.fichier(courante.photo!!),
                    contentDescription = "Modèle : ${courante.modeleNom}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(Rayon.xl)),
                )
            }
        }

        item {
            Column {
                Text(courante.modeleNom, style = MaterialTheme.typography.headlineSmall)
                if (client != null) {
                    TextButton(
                        onClick = { navigation.navigate(Route.client(client.id)) },
                        contentPadding = PaddingValues(0.dp()),
                    ) { Text(client.nom) }
                }
            }
        }

        item {
            val texte = when {
                courante.statut == Statut.LIVREE ->
                    "Livrée le ${dateLongue(courante.dateLivraison)}"
                situation.enRetard ->
                    "En retard de ${-situation.joursRestants} jour" +
                        "${if (situation.joursRestants < -1) "s" else ""} — " +
                        "promise ${dateLongue(courante.dateLivraison)}"
                else -> "Livraison ${delai(courante.dateLivraison)} — ${dateLongue(courante.dateLivraison)}"
            }
            Text(
                text = texte,
                style = MaterialTheme.typography.bodyLarge,
                color = if (situation.enRetard) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
        }

        item { Parcours(courante.statut) }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(Espace.trois)) {
                if (suivant != null) {
                    Button(
                        onClick = {
                            if (suivant == Statut.LIVREE && courante.reste > 0) {
                                demandeSolde = true
                            } else {
                                modeleVue.avancer(courante) { message(suivant.libelle) }
                            }
                        },
                    ) {
                        IconeSymbole(icone = iconeDe(suivant), taille = Taille.petite)
                        Text("  ${suivant.actionPourAtteindre}")
                    }
                }
                OutlinedButton(onClick = { message("Envoi de la fiche — à brancher") }) {
                    IconeSymbole(icone = Icones.Send, taille = Taille.petite)
                    Text("  Envoyer la fiche")
                }
            }
        }

        item { SousTitreCommande("Argent") }
        item { LigneInfo("Montant total", montant(courante.prixTotal)) }
        item { LigneInfo("Avance versée", montant(courante.acompte)) }
        item {
            LigneInfo(
                if (courante.soldeRegle) "Soldé" else "Reste à payer",
                montant(courante.reste),
                fort = true,
            )
        }
        if (courante.reste > 0) {
            item {
                OutlinedButton(
                    onClick = {
                        modeleVue.mettreAJourCommande(courante.copy(soldeRegle = true))
                        message("Solde réglé")
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    IconeSymbole(icone = Icones.Payments, taille = Taille.petite)
                    Text("  Marquer le solde réglé")
                }
            }
        }

        val mesures = Mesure.entries.filter { courante.mesures[it]?.isNotBlank() == true }
        if (mesures.isNotEmpty()) {
            item { SousTitreCommande("Mesures de cette commande") }
            items(mesures) { mesure ->
                LigneInfo(mesure.libelle, "${courante.mesures[mesure]} cm")
            }
        }

        item { SousTitreCommande("Détail") }
        item { LigneInfo("Commandé le", dateLongue(courante.dateCommande)) }
        item { LigneInfo("Temps de confection", courante.cadence.libelle) }

        item {
            TextButton(onClick = { demandeSuppression = true }) {
                IconeSymbole(icone = Icones.Delete, taille = Taille.petite)
                Text("  Supprimer")
            }
        }
    }

    /* Une commande qui passe a « Livree » demande une seule chose :
       le solde a-t-il ete regle ? Si non, elle reste comptee dans ce
       qui reste a encaisser et le couturier ne l'oublie pas. */
    if (demandeSolde) {
        AlertDialog(
            onDismissRequest = { demandeSolde = false },
            title = { Text("Le solde a-t-il été réglé ?") },
            text = {
                Text(
                    "Reste ${montant(courante.reste)}. Sinon la commande reste " +
                        "comptée dans ce qui vous est dû.",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    demandeSolde = false
                    modeleVue.avancer(courante, soldeRegle = true) { message("Livrée") }
                }) { Text("Oui, réglé") }
            },
            dismissButton = {
                TextButton(onClick = {
                    demandeSolde = false
                    modeleVue.avancer(courante, soldeRegle = false) { message("Livrée") }
                }) { Text("Pas encore") }
            },
        )
    }

    if (demandeSuppression) {
        AlertDialog(
            onDismissRequest = { demandeSuppression = false },
            title = { Text("Supprimer cette commande ?") },
            text = { Text("${courante.modeleNom} — la fiche et son historique disparaissent.") },
            confirmButton = {
                TextButton(onClick = {
                    demandeSuppression = false
                    modeleVue.supprimerCommande(courante) {
                        message("Commande supprimée")
                        navigation.popBackStack()
                    }
                }) { Text("Supprimer") }
            },
            dismissButton = {
                TextButton(onClick = { demandeSuppression = false }) { Text("Annuler") }
            },
        )
    }
}

@Composable
private fun Parcours(courant: Statut) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Espace.un),
    ) {
        Statut.entries.forEach { statut ->
            val atteint = statut.ordinal <= courant.ordinal
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Espace.un),
            ) {
                IconeSymbole(
                    icone = iconeDe(statut),
                    taille = Taille.petite,
                    remplie = atteint,
                    couleur = if (statut == courant) {
                        MaterialTheme.colorScheme.primary
                    } else if (atteint) {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    } else {
                        MaterialTheme.colorScheme.outlineVariant
                    },
                )
                Text(
                    text = statut.libelle,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (statut == courant) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
        }
    }
}

@Composable
private fun SousTitreCommande(texte: String) {
    Text(
        text = texte,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(top = Espace.quatre),
    )
}

private fun Int.dp() = androidx.compose.ui.unit.Dp(this.toFloat())
