package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.navigation.NavHostController
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.correspondA
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.EtatVide
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Pastille
import com.essama.dresscode.ui.Route

/*
 * Une cliente revient apres six mois : au cahier, ses mesures sont
 * trois cahiers en arriere, et en pratique le couturier remesure.
 * Ici on tape un nom ou les quatre derniers chiffres d'un numero, et
 * la fiche apparait.
 */
@Composable
fun EcranClients(modeleVue: ModeleVue, navigation: NavHostController) {
    val clients by modeleVue.clients.collectAsState()
    val commandes by modeleVue.commandes.collectAsState()
    var recherche by remember { mutableStateOf("") }

    val trouves = clients.filter { it.correspondA(recherche) }

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.quatre, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.trois),
    ) {
        item {
            OutlinedTextField(
                value = recherche,
                onValueChange = { recherche = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = androidx.compose.foundation.shape.RoundedCornerShape(Rayon.plein),
                label = { Text("Nom ou quatre derniers chiffres") },
                leadingIcon = { IconeSymbole(icone = Icones.Search) },
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                    imeAction = ImeAction.Search,
                ),
            )
        }

        if (trouves.isEmpty()) {
            item {
                EtatVide(
                    icone = Icones.Group,
                    titre = if (clients.isEmpty()) {
                        "Les clientes s’ajoutent en créant une commande."
                    } else {
                        "Aucune cliente à ce nom."
                    },
                    action = {
                        Button(onClick = { navigation.navigate(Route.nouvelleCommande()) }) {
                            Text("Nouvelle commande")
                        }
                    },
                )
            }
        }

        items(trouves, key = { it.id }) { client ->
            val siennes = commandes.filter { it.clientId == client.id }
            val enCours = siennes.count { it.statut != Statut.LIVREE }
            val du = siennes.sumOf { it.reste }

            CarteLien(
                titre = client.nom,
                detail = listOfNotNull(
                    client.telephone.ifBlank { null },
                    if (enCours > 0) "$enCours en cours" else null,
                    if (du > 0) "solde à encaisser" else null,
                ).joinToString(" · ").ifBlank { "Aucune commande" },
                debut = { Pastille(client.nom) },
                fin = {
                    if (du > 0) {
                        Badge(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer,
                        ) { Text("Impayé") }
                    } else {
                        IconeSymbole(
                            icone = Icones.ChevronRight,
                            couleur = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                surClic = { navigation.navigate(Route.client(client.id)) },
            )
        }
    }
}
