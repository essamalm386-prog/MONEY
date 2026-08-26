package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.navigation.NavHostController
import com.essama.dresscode.charte.Apparence
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.ui.LigneInfo
import com.essama.dresscode.ui.ModeleVue

/*
 * La fiche atelier se remplit une seule fois, en trente secondes, et
 * ressert a vie sur tous les envois. C'est elle qui fait qu'une
 * cliente qui montre son recapitulatif a ses soeurs leur montre
 * aussi le nom et le numero de l'atelier.
 */
@Composable
fun EcranAtelier(
    modeleVue: ModeleVue,
    navigation: NavHostController,
    message: (String) -> Unit,
) {
    val atelier by modeleVue.atelier.collectAsState()
    val clients by modeleVue.clients.collectAsState()
    val commandes by modeleVue.commandes.collectAsState()
    val modeles by modeleVue.modeles.collectAsState()
    val apparence by modeleVue.depot.reglages.apparence.collectAsState(initial = Apparence.Systeme)

    var brouillon by remember(atelier) { mutableStateOf(atelier) }

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.six, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        item { Text("Atelier", style = MaterialTheme.typography.headlineMedium) }

        item {
            Text(
                "Apparaît sur les fiches envoyées aux clientes.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            Champ("Nom de l’atelier", brouillon.nom) { brouillon = brouillon.copy(nom = it) }
        }
        item {
            Champ("Téléphone", brouillon.telephone, KeyboardType.Phone) {
                brouillon = brouillon.copy(telephone = it)
            }
        }
        item {
            Champ("Adresse", brouillon.adresse) { brouillon = brouillon.copy(adresse = it) }
        }
        item {
            Champ("Indicatif du pays", brouillon.indicatif, KeyboardType.Number) {
                brouillon = brouillon.copy(indicatif = it.filter(Char::isDigit))
            }
            Text(
                "Complète les numéros notés en local pour ouvrir WhatsApp.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            Button(
                onClick = {
                    modeleVue.enregistrerAtelier(brouillon)
                    message("Atelier enregistré")
                },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Enregistrer") }
        }

        item { Titre("Apparence") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(Espace.deux)) {
                listOf(
                    Apparence.Systeme to "Système",
                    Apparence.Clair to "Clair",
                    Apparence.Sombre to "Sombre",
                ).forEach { (valeur, libelle) ->
                    FilterChip(
                        selected = apparence == valeur,
                        onClick = { modeleVue.enregistrerApparence(valeur) },
                        label = { Text(libelle) },
                    )
                }
            }
        }

        item { Titre("Rappel du matin") }
        item {
            Text(
                "Un résumé par jour au maximum, jamais une alerte par commande.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Recevoir le résumé", style = MaterialTheme.typography.bodyLarge)
                Switch(
                    checked = brouillon.rappelActif,
                    onCheckedChange = {
                        brouillon = brouillon.copy(rappelActif = it)
                        modeleVue.enregistrerAtelier(brouillon)
                    },
                )
            }
        }
        if (brouillon.rappelActif) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(Espace.deux)) {
                    listOf(6, 7, 8, 9).forEach { heure ->
                        FilterChip(
                            selected = brouillon.heureRappel == heure,
                            onClick = {
                                brouillon = brouillon.copy(heureRappel = heure)
                                modeleVue.enregistrerAtelier(brouillon)
                            },
                            label = { Text("${heure}h") },
                        )
                    }
                }
            }
        }

        item { Titre("Sur cet appareil") }
        item {
            Text(
                "Clientes, mesures et photos restent sur ce téléphone. " +
                    "Rien n’est envoyé nulle part.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item { LigneInfo("Clientes", clients.size.toString()) }
        item { LigneInfo("Commandes", commandes.size.toString()) }
        item { LigneInfo("Modèles", modeles.size.toString()) }

        item {
            Text(
                "DRESS CODE By Essama",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Titre(texte: String) {
    Text(
        text = texte,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun Champ(
    libelle: String,
    valeur: String,
    clavier: KeyboardType = KeyboardType.Text,
    surChangement: (String) -> Unit,
) {
    OutlinedTextField(
        value = valeur,
        onValueChange = surChangement,
        label = { Text(libelle) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = clavier),
    )
}
