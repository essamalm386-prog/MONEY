package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.EtatVide
import com.essama.dresscode.ui.ModeleVue

/*
 * Le catalogue est l'etagere rangee du savoir-faire.
 *
 * Aujourd'hui les photos de modeles sont eparpillees : galerie du
 * telephone, discussions WhatsApp, captures d'ecran. Quand une
 * cliente demande « montrez-moi ce que vous faites », le couturier
 * fait defiler sa galerie en passant devant des photos de famille.
 *
 * Trois informations par modele, pas plus : une photo, un nom court,
 * un prix indicatif. Le prix est toujours « a partir de » — le tarif
 * reel depend du tissu et des finitions, et afficher un prix ferme
 * mettrait le couturier en difficulte face a une cliente qui le
 * brandit.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun EcranModeles(modeleVue: ModeleVue, message: (String) -> Unit) {
    val modeles by modeleVue.modeles.collectAsState()
    var selection by remember { mutableStateOf(setOf<Long>()) }

    Scaffold(
        floatingActionButton = {
            /* Le bouton disparait pendant une selection : la barre
               d'envoi occupe le meme coin, et c'est elle qui porte
               l'action du moment. */
            if (selection.isEmpty()) {
                ExtendedFloatingActionButton(
                    modifier = Modifier.testTag("action-principale"),
                    onClick = { message("Ajout d’un modèle — à brancher") },
                    icon = { IconeSymbole(icone = Icones.Add) },
                    text = { Text("Modèle") },
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        },
        bottomBar = {
            if (selection.isNotEmpty()) {
                BarreEnvoi(
                    nombre = selection.size,
                    surAnnuler = { selection = emptySet() },
                    surEnvoyer = {
                        message("Envoi à une cliente — à brancher")
                        selection = emptySet()
                    },
                )
            }
        },
    ) { marges ->
        if (modeles.isEmpty()) {
            EtatVide(
                icone = Icones.PhotoLibrary,
                titre = "Le catalogue se remplit à chaque livraison. " +
                    "Vous pouvez aussi ajouter un modèle maintenant.",
                modifier = Modifier.padding(marges),
            )
            return@Scaffold
        }

        LazyVerticalGrid(
            columns = GridCells.Adaptive(150.dp),
            modifier = Modifier.padding(marges),
            contentPadding = PaddingValues(Espace.quatre),
            horizontalArrangement = Arrangement.spacedBy(Espace.quatre),
            verticalArrangement = Arrangement.spacedBy(Espace.quatre),
        ) {
            items(modeles, key = { it.id }) { modele ->
                CarteModele(
                    modele = modele,
                    fichierPhoto = modele.photo?.let { modeleVue.depot.photos.fichier(it) },
                    choisi = modele.id in selection,
                    enSelection = selection.isNotEmpty(),
                    surAppui = {
                        selection = if (selection.isEmpty()) {
                            selection
                        } else if (modele.id in selection) {
                            selection - modele.id
                        } else {
                            selection + modele.id
                        }
                    },
                    surAppuiLong = {
                        selection = if (modele.id in selection) {
                            selection - modele.id
                        } else {
                            selection + modele.id
                        }
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CarteModele(
    modele: ModeleCatalogue,
    fichierPhoto: java.io.File?,
    choisi: Boolean,
    enSelection: Boolean,
    surAppui: () -> Unit,
    surAppuiLong: () -> Unit,
) {
    Column(
        modifier = Modifier.combinedClickable(
            onClick = surAppui,
            onLongClick = surAppuiLong,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.deux),
    ) {
        Box {
            if (fichierPhoto != null) {
                AsyncImage(
                    model = fichierPhoto,
                    contentDescription = modele.nom,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(3f / 4f)
                        .clip(RoundedCornerShape(Rayon.lg)),
                )
            } else {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(3f / 4f)
                        .background(
                            MaterialTheme.colorScheme.surfaceVariant,
                            RoundedCornerShape(Rayon.lg),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    IconeSymbole(
                        icone = Icones.Checkroom,
                        taille = Taille.grande,
                        couleur = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (choisi) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(Espace.deux)
                        .size(28.dp)
                        .background(MaterialTheme.colorScheme.primary, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    IconeSymbole(
                        icone = Icones.Check,
                        taille = Taille.petite,
                        couleur = MaterialTheme.colorScheme.onPrimary,
                    )
                }
            }
        }

        Text(modele.nom, style = MaterialTheme.typography.bodyMedium)
        if (modele.prixIndicatif > 0) {
            Text(
                "à partir de ${montant(modele.prixIndicatif)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/*
 * Une cliente, choisie, a un moment choisi. Pas de selection
 * multiple de clientes, pas d'envoi programme, pas de campagne :
 * WhatsApp suspend les numeros qui font de l'envoi en masse, et un
 * couturier dont le numero professionnel est bloque perd sa
 * clientele du jour au lendemain.
 */
@Composable
private fun BarreEnvoi(nombre: Int, surAnnuler: () -> Unit, surEnvoyer: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(Espace.quatre),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        Text(
            "$nombre modèle${if (nombre > 1) "s" else ""}",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.weight(1f),
        )
        androidx.compose.material3.TextButton(onClick = surAnnuler) { Text("Annuler") }
        Button(onClick = surEnvoyer) {
            IconeSymbole(icone = Icones.Send, taille = Taille.petite)
            Text("  Envoyer")
        }
    }
}
