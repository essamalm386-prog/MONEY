package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Mesure
import com.essama.dresscode.metier.cleLibre
import com.essama.dresscode.metier.libelleMesure
import com.essama.dresscode.metier.mesuresOrdonnees

/*
 * Prendre ou corriger des mesures.
 *
 * Un carnet n'a pas de liste fermee : le couturier ecrit « tour de
 * tete » dans la marge quand un boubou le demande. L'application le
 * laisse faire — les douze du metier d'abord, les siennes ensuite,
 * dans l'ordre ou il les a ajoutees.
 *
 * Les mesures se corrigent : une cliente change, une prise est
 * fausse, une commande demande une longueur particuliere. Les figer
 * a la creation obligerait a refaire la commande pour un chiffre.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeuilleMesures(
    titre: String,
    mesures: Map<String, String>,
    surFermeture: () -> Unit,
    surValidation: (Map<String, String>) -> Unit,
) {
    val etat = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    /* Les douze standard sont toujours proposees, meme vides : c'est
       la feuille de prise de mesures, pas un resume. Les libres qui
       existent deja viennent apres, et gardent leur ordre. */
    val libresInitiales = mesuresOrdonnees(mesures)
        .map { it.first }
        .filter { Mesure.parCle(it) == null }

    val valeurs = remember {
        Mesure.entries.map { it.cle to (mesures[it.cle].orEmpty()) }
            .plus(libresInitiales.map { it to mesures[it].orEmpty() })
            .toMutableStateMap()
    }
    var libres by remember { mutableStateOf(libresInitiales) }
    var etendues by remember {
        mutableStateOf(Mesure.supplementaires.any { !mesures[it.cle].isNullOrBlank() })
    }
    var nouvelleMesure by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = surFermeture, sheetState = etat) {
        Column(
            modifier = Modifier
                .testTag("feuille-mesures")
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Espace.quatre)
                .padding(bottom = Espace.huit),
            verticalArrangement = Arrangement.spacedBy(Espace.trois),
        ) {
            Text(titre, style = MaterialTheme.typography.headlineSmall)

            /* Deux colonnes : douze champs pleine largeur obligeraient
               a faire defiler pendant la prise, et le seul point ou le
               papier gagne est la vitesse de saisie. */
            val affichees = buildList {
                addAll(Mesure.base.map { it.cle })
                if (etendues) addAll(Mesure.supplementaires.map { it.cle })
                addAll(libres)
            }

            affichees.chunked(2).forEach { paire ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Espace.trois),
                ) {
                    paire.forEach { cle ->
                        OutlinedTextField(
                            value = valeurs[cle].orEmpty(),
                            onValueChange = { valeurs[cle] = it.filter { c -> c.isDigit() || c == ',' || c == '.' } },
                            label = { Text(libelleMesure(cle)) },
                            suffix = { Text("cm") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (paire.size == 1) Spacer(Modifier.weight(1f))
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Espace.deux),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (!etendues) {
                    TextButton(onClick = { etendues = true }) { Text("Plus de mesures") }
                }
                TextButton(
                    onClick = { nouvelleMesure = "" },
                    modifier = Modifier.testTag("autre-mesure"),
                ) {
                    IconeSymbole(icone = Icones.Add, taille = Taille.petite)
                    Text("  Autre mesure")
                }
            }

            /* Nommer soi-meme une mesure : le champ apparait sous le
               nom donne, et la valeur se saisit avec les autres. */
            nouvelleMesure?.let { saisie ->
                OutlinedTextField(
                    value = saisie,
                    onValueChange = { nouvelleMesure = it },
                    label = { Text("Nom de la mesure") },
                    placeholder = { Text("Tour de tête") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("nom-mesure"),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Espace.deux)) {
                    TextButton(onClick = { nouvelleMesure = null }) { Text("Annuler") }
                    Button(
                        onClick = {
                            val cle = cleLibre(saisie)
                            if (cle.isNotBlank() && cle !in valeurs) {
                                valeurs[cle] = ""
                                libres = libres + cle
                            }
                            nouvelleMesure = null
                        },
                        enabled = cleLibre(saisie).isNotBlank(),
                    ) { Text("Ajouter") }
                }
            }

            Button(
                onClick = {
                    /* Seules les mesures renseignees sont gardees : une
                       ligne vide dans le carnet ne veut rien dire. */
                    val gardees = LinkedHashMap<String, String>()
                    affichees.forEach { cle ->
                        valeurs[cle]?.trim()?.takeIf { it.isNotBlank() }?.let { gardees[cle] = it }
                    }
                    surValidation(gardees)
                },
                modifier = Modifier.fillMaxWidth().testTag("enregistrer-mesures"),
            ) {
                Text("Enregistrer")
            }
        }
    }
}
