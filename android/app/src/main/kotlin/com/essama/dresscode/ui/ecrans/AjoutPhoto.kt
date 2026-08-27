package com.essama.dresscode.ui.ecrans

import android.content.ActivityNotFoundException
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.ui.ModeleVue
import kotlinx.coroutines.launch
import java.io.File

/*
 * Une photo de modele arrive de deux endroits, et le couturier ne
 * choisit pas : cela depend du vetement qu'il a devant lui.
 *
 *   — La cliente lui montre une photo sur son telephone, ou il l'a
 *     recue par WhatsApp : elle est dans la galerie.
 *   — Le vetement est fini, sur le mannequin, dans l'atelier : il le
 *     photographie maintenant.
 *
 * N'offrir que la galerie obligeait a sortir de l'application, ouvrir
 * l'appareil photo, revenir, rechercher le cliche. Les deux chemins
 * sont donc proposes au meme endroit, du meme geste.
 */

/**
 * Rend la fonction qui ouvre le choix. La photo est reduite et rangee
 * dans le stockage prive ; le nom du fichier part vers [surPhoto].
 */
@Composable
fun rememberAjoutPhoto(
    modeleVue: ModeleVue,
    message: (String) -> Unit,
    surPhoto: (String) -> Unit,
): () -> Unit {
    val portee = rememberCoroutineScope()
    var choixOuvert by remember { mutableStateOf(false) }

    /* Le fichier ou l'appareil photo ecrira. Retenu ici parce que le
       resultat de la prise ne rend qu'un booleen : c'est a nous de
       savoir ou regarder. */
    var prise by remember { mutableStateOf<File?>(null) }

    val ranger: (Uri) -> Unit = { adresse ->
        portee.launch {
            val nom = modeleVue.depot.photos.enregistrer(adresse)
            /* Le cliche brut a fait son office : sa copie reduite est
               rangee, il n'a pas a encombrer le cache. */
            prise?.delete()
            prise = null
            if (nom != null) surPhoto(nom) else message("Photo illisible")
        }
    }

    val galerie = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { adresse -> if (adresse != null) ranger(adresse) }

    val appareil = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { reussi ->
        val fichier = prise
        if (reussi && fichier != null) {
            ranger(modeleVue.depot.photos.adressePartagee(fichier))
        } else {
            fichier?.delete()
            prise = null
        }
    }

    if (choixOuvert) {
        /* Un dialogue, pas une feuille : la fiche modele est deja une
           feuille, et une feuille par-dessus une feuille se glisse
           derriere sur certains telephones. Deux choix tiennent de
           toute facon dans un dialogue. */
        AlertDialog(
            onDismissRequest = { choixOuvert = false },
            modifier = Modifier.testTag("choix-photo"),
            title = { Text("Ajouter une photo") },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(Espace.trois),
                ) {
                    OutlinedButton(
                        onClick = {
                            choixOuvert = false
                            val fichier = modeleVue.depot.photos.fichierDePrise()
                            prise = fichier
                            try {
                                appareil.launch(modeleVue.depot.photos.adressePartagee(fichier))
                            } catch (_: ActivityNotFoundException) {
                                /* Un telephone sans application photo
                                   existe. Le dire, plutot que de ne
                                   rien faire. */
                                fichier.delete()
                                prise = null
                                message("Aucun appareil photo sur ce téléphone")
                            }
                        },
                        modifier = Modifier.fillMaxWidth().testTag("prendre-photo"),
                    ) {
                        IconeSymbole(icone = Icones.PhotoCamera, taille = Taille.petite)
                        Text("  Prendre une photo")
                    }

                    OutlinedButton(
                        onClick = {
                            choixOuvert = false
                            galerie.launch(
                                PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageOnly,
                                ),
                            )
                        },
                        modifier = Modifier.fillMaxWidth().testTag("choisir-galerie"),
                    ) {
                        IconeSymbole(icone = Icones.PhotoLibrary, taille = Taille.petite)
                        Text("  Choisir dans la galerie")
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { choixOuvert = false }) { Text("Annuler") }
            },
        )
    }

    return { choixOuvert = true }
}
