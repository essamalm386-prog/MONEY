package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Categorie
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.ui.ModeleVue

/*
 * Un modele tient en trois informations : une photo, un nom court,
 * un prix indicatif. Rien de plus n'est demande, parce que rien de
 * plus n'est regarde quand on montre le catalogue a une cliente.
 *
 * Le prix est toujours affiche « a partir de » : le tarif reel
 * depend du tissu et des finitions, et un prix ferme mettrait le
 * couturier en difficulte face a une cliente qui le brandit.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeuilleModele(
    modeleVue: ModeleVue,
    modele: ModeleCatalogue?,
    message: (String) -> Unit,
    surFermeture: () -> Unit,
) {
    val etat = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var nom by remember { mutableStateOf(modele?.nom.orEmpty()) }
    var prix by remember { mutableStateOf(modele?.prixIndicatif?.takeIf { it > 0 }?.toString().orEmpty()) }
    var categorie by remember { mutableStateOf(modele?.categorie) }
    var photo by remember { mutableStateOf(modele?.photo) }

    val ajouterPhoto = rememberAjoutPhoto(
        modeleVue = modeleVue,
        message = message,
        surPhoto = { photo = it },
    )

    ModalBottomSheet(onDismissRequest = surFermeture, sheetState = etat) {
        Column(
            modifier = Modifier
                .testTag("feuille-modele")
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Espace.quatre)
                .padding(bottom = Espace.huit),
            verticalArrangement = Arrangement.spacedBy(Espace.trois),
        ) {
            Text(
                if (modele == null) "Nouveau modèle" else modele.nom,
                style = MaterialTheme.typography.headlineSmall,
            )

            /* La photo est la premiere chose qu'on ajoute, alors c'est
               elle la plus grande cible : l'emplacement lui-meme ouvre
               la galerie, sans bouton separe en dessous.

               Vide, il reste bas — un rectangle gris au format 4:3
               occupait la moitie de la feuille et repoussait le nom et
               le prix hors de l'ecran sur un petit telephone. Rempli,
               il reprend le 4:3 : c'est la photo qu'on vient voir. */
            val fichier = photo?.let { modeleVue.depot.photos.fichier(it) }

            if (fichier != null) {
                AsyncImage(
                    model = fichier,
                    contentDescription = nom.ifBlank { "Modèle" },
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(4f / 3f)
                        .clip(RoundedCornerShape(Rayon.lg))
                        .clickable(onClick = ajouterPhoto)
                        .testTag("photo-modele"),
                )
                TextButton(onClick = ajouterPhoto, modifier = Modifier.fillMaxWidth()) {
                    IconeSymbole(icone = Icones.AddPhotoAlternate, taille = Taille.petite)
                    Text("  Changer la photo")
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(148.dp)
                        .clip(RoundedCornerShape(Rayon.lg))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(onClick = ajouterPhoto)
                        .testTag("photo-modele"),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    IconeSymbole(
                        icone = Icones.AddPhotoAlternate,
                        taille = Taille.grande,
                        couleur = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Ajouter une photo",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = Espace.deux),
                    )
                }
            }

            OutlinedTextField(
                value = nom,
                onValueChange = { nom = it },
                label = { Text("Nom") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("nom-modele"),
            )

            OutlinedTextField(
                value = prix,
                onValueChange = { prix = it.filter(Char::isDigit) },
                label = { Text("Prix indicatif") },
                suffix = { Text("F") },
                supportingText = { Text("Affiché « à partir de », modifiable à chaque commande.") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().testTag("prix-modele"),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(Espace.deux)) {
                Categorie.entries.forEach { valeur ->
                    FilterChip(
                        selected = categorie == valeur,
                        onClick = { categorie = if (categorie == valeur) null else valeur },
                        label = { Text(valeur.libelle) },
                    )
                }
            }

            Button(
                onClick = {
                    if (nom.isBlank()) {
                        message("Nom du modèle obligatoire")
                        return@Button
                    }
                    modeleVue.enregistrerModele(
                        ModeleCatalogue(
                            id = modele?.id ?: 0,
                            nom = nom.trim(),
                            categorie = categorie,
                            prixIndicatif = prix.toLongOrNull() ?: 0,
                            photo = photo,
                            creeLe = modele?.creeLe ?: 0,
                        ),
                    )
                    message(if (modele == null) "Modèle ajouté" else "Modèle modifié")
                    surFermeture()
                },
                modifier = Modifier.fillMaxWidth().testTag("enregistrer-modele"),
            ) {
                Text("Enregistrer")
            }

            /* Retirer un modele du catalogue ne touche pas aux
               commandes qui l'ont utilise : elles gardent leur propre
               photo, prise au moment de la commande. */
            if (modele != null) {
                TextButton(
                    onClick = {
                        modeleVue.supprimerModele(modele)
                        message("Modèle retiré")
                        surFermeture()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    IconeSymbole(icone = Icones.Delete, taille = Taille.petite)
                    Text("  Retirer du catalogue")
                }
            }
        }
    }
}
