package com.essama.dresscode.ui.ecrans

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.core.content.res.ResourcesCompat
import com.essama.dresscode.R
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.charte.schemaClair
import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.Statut
import com.essama.dresscode.metier.correspondA
import com.essama.dresscode.metier.normaliser
import com.essama.dresscode.partage.DessinRecapitulatif
import com.essama.dresscode.partage.Partage
import com.essama.dresscode.partage.Variante
import com.essama.dresscode.partage.nomFichier
import com.essama.dresscode.partage.texteModeles
import com.essama.dresscode.partage.texteRecapitulatif
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.EtatVide
import com.essama.dresscode.ui.ModeleVue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/* ============================================================
   ENVOI
   ------------------------------------------------------------
   Tout ce qui sort de l'application vers une cliente passe par
   ici. L'envoi est assiste : l'application prepare l'image et le
   texte, ouvre WhatsApp, et c'est le couturier qui appuie sur
   envoyer.

   Ce n'est pas de la prudence de principe. WhatsApp suspend les
   numeros qui font de l'envoi en masse non sollicite, et un
   couturier dont le numero professionnel est bloque perd sa
   clientele du jour au lendemain. D'ou les regles qui tiennent
   dans ce fichier : une cliente a la fois, choisie a la main, au
   moment ou le couturier le decide. Pas de selection multiple de
   clientes, pas d'envoi programme, pas de campagne.
   ============================================================ */

/** La forme de la fiche se deduit de l'etat de la commande. */
fun varianteDe(commande: Commande): Variante = when (commande.statut) {
    Statut.LIVREE -> Variante.LIVREE
    Statut.PRETE -> Variante.PRETE
    else -> Variante.COMMANDE
}

/*
 * La fiche que la cliente recoit, en apercu puis en un appui.
 *
 * Elle est deja dessinee quand la feuille s'ouvre : demander
 * « generer » puis « envoyer » ajouterait un appui sans rien
 * apporter.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeuilleRecapitulatif(
    modeleVue: ModeleVue,
    atelier: Atelier,
    client: Client?,
    commande: Commande,
    variante: Variante = varianteDe(commande),
    message: (String) -> Unit,
    surFermeture: () -> Unit,
) {
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val etat = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var fiche by remember { mutableStateOf<Bitmap?>(null) }
    var echec by remember { mutableStateOf(false) }

    val destinataire = client ?: Client(nom = "", telephone = "")
    val texte = texteRecapitulatif(atelier, destinataire, commande, variante)

    LaunchedEffect(commande.id, variante) {
        fiche = runCatching { dessiner(contexte, modeleVue, atelier, destinataire, commande, variante) }
            .onFailure { echec = true }
            .getOrNull()
    }

    /* Une trace legere : une ligne dans la fiche cliente, pas un
       historique de conversation. Elle sert a savoir qu'il faut
       relancer, rien de plus. */
    val tracer = {
        modeleVue.mettreAJourCommande(commande.copy(recapEnvoyeLe = System.currentTimeMillis()))
        if (client != null) {
            modeleVue.noterEnvoi(
                client.id,
                if (variante == Variante.COMMANDE) "recapitulatif" else variante.name.lowercase(),
            )
        }
    }

    ModalBottomSheet(onDismissRequest = surFermeture, sheetState = etat) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Espace.quatre)
                .padding(bottom = Espace.huit),
            verticalArrangement = Arrangement.spacedBy(Espace.quatre),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(variante.titre, style = MaterialTheme.typography.headlineSmall)

            val apercu = fiche
            when {
                echec -> Text(
                    "La fiche n’a pas pu être préparée. Réessayez.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                apercu == null -> Column(
                    modifier = Modifier.padding(vertical = Espace.douze),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Espace.quatre),
                ) {
                    CircularProgressIndicator()
                    Text("Préparation de la fiche…", style = MaterialTheme.typography.bodyMedium)
                }
                else -> Image(
                    bitmap = apercu.asImageBitmap(),
                    contentDescription = "Récapitulatif pour ${client?.nom ?: "la cliente"}",
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 340.dp)
                        .clip(RoundedCornerShape(Rayon.lg))
                        .testTag("apercu-recapitulatif"),
                )
            }

            Button(
                onClick = {
                    val image = fiche ?: return@Button
                    portee.launch {
                        val partage = Partage(contexte)
                        val adresse = partage.ecrireImage(image, nomFichier(destinataire, commande))
                        contexte.startActivity(partage.partager(listOf(adresse), texte))
                        tracer()
                        message("Fiche prête — appuyez sur envoyer dans WhatsApp")
                        surFermeture()
                    }
                },
                enabled = fiche != null,
                modifier = Modifier.fillMaxWidth().testTag("envoyer-recapitulatif"),
            ) {
                IconeSymbole(icone = Icones.Send, taille = Taille.petite)
                Text("  Envoyer par WhatsApp")
            }

            /* Le PDF n'arrive qu'en second : l'image s'affiche dans
               WhatsApp sans telechargement, c'est ce qui sert dans
               presque tous les cas. Le PDF est la pour les commandes
               importantes, quand la cliente veut imprimer. */
            TextButton(
                onClick = {
                    val image = fiche ?: return@TextButton
                    portee.launch {
                        val partage = Partage(contexte)
                        val adresse = partage.ecrirePdf(image, nomFichier(destinataire, commande))
                        contexte.startActivity(
                            partage.partager(listOf(adresse), texte, type = "application/pdf"),
                        )
                        tracer()
                        message("PDF prêt — appuyez sur envoyer dans WhatsApp")
                        surFermeture()
                    }
                },
                enabled = fiche != null,
            ) {
                IconeSymbole(icone = Icones.PictureAsPdf, taille = Taille.petite)
                Text("  En PDF")
            }

            if (client?.telephone.isNullOrBlank()) {
                Text(
                    "Numéro de la cliente absent : choisissez-la dans WhatsApp.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private suspend fun dessiner(
    contexte: Context,
    modeleVue: ModeleVue,
    atelier: Atelier,
    client: Client,
    commande: Commande,
    variante: Variante,
): Bitmap {
    val photo = modeleVue.depot.photos.charger(commande.photo)
    return withContext(Dispatchers.Default) {
        DessinRecapitulatif(
            couleurs = schemaClair,
            marque = police(contexte, R.font.roboto_flex),
            courant = police(contexte, R.font.roboto),
        ).dessiner(atelier, client, commande, photo, variante)
    }
}

private fun police(contexte: Context, ressource: Int): android.graphics.Typeface =
    ResourcesCompat.getFont(contexte, ressource) ?: android.graphics.Typeface.DEFAULT

/*
 * Choisir la destinataire : une cliente, une seule, cherchee a la
 * main. La recherche accepte un nom ou les derniers chiffres du
 * numero — c'est ainsi qu'un couturier retrouve une cliente dont
 * il ne sait plus l'orthographe du nom.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeuilleChoisirCliente(
    clients: List<Client>,
    titre: String,
    surChoix: (Client) -> Unit,
    surFermeture: () -> Unit,
) {
    val etat = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var recherche by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = surFermeture, sheetState = etat) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Espace.quatre)
                .padding(bottom = Espace.huit),
            verticalArrangement = Arrangement.spacedBy(Espace.trois),
        ) {
            Text(titre, style = MaterialTheme.typography.headlineSmall)
            Text(
                "Une cliente à la fois.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = recherche,
                onValueChange = { recherche = it },
                label = { Text("Nom ou quatre derniers chiffres") },
                leadingIcon = { IconeSymbole(icone = Icones.Search) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            val trouvees = clients.filter { it.correspondA(recherche) }.take(8)
            if (trouvees.isEmpty()) {
                EtatVide(
                    icone = Icones.Group,
                    titre = if (clients.isEmpty()) {
                        "Aucune cliente pour l’instant. Elles s’ajoutent à la première commande."
                    } else {
                        "Aucune cliente à ce nom."
                    },
                )
            } else {
                trouvees.forEach { candidate ->
                    CarteLien(
                        titre = candidate.nom,
                        detail = candidate.telephone.ifBlank { "Numéro non renseigné" },
                        fin = { IconeSymbole(icone = Icones.Send, taille = Taille.petite) },
                        surClic = { surChoix(candidate) },
                    )
                }
            }
        }
    }
}

/*
 * Envoi de modeles : les photos choisies, le texte prepare, une
 * cliente. Les modeles sans photo partent quand meme, cites dans
 * le texte — un nom et un prix valent mieux que rien.
 */
suspend fun envoyerModeles(
    contexte: Context,
    modeleVue: ModeleVue,
    atelier: Atelier,
    client: Client,
    modeles: List<ModeleCatalogue>,
) {
    val partage = Partage(contexte)
    val adresses = modeles.mapIndexedNotNull { rang, modele ->
        val image = modeleVue.depot.photos.charger(modele.photo) ?: return@mapIndexedNotNull null
        /* Le rang prefixe le nom : deux modeles homonymes ecriraient
           sinon dans le meme fichier, et la cliente recevrait deux
           fois la meme photo. */
        val propre = normaliser(modele.nom).replace(Regex("[^a-z0-9]+"), "-").trim('-')
        partage.ecrireImage(image, "${rang + 1}-${propre.ifEmpty { "modele" }}")
    }
    val texte = texteModeles(atelier, client, modeles)

    val intention = if (adresses.isEmpty()) {
        partage.conversation(client.telephone, atelier.indicatif, texte)
    } else {
        partage.partager(adresses, texte)
    }
    contexte.startActivity(intention)
    modeleVue.noterEnvoi(client.id, "modeles", modeles.size)
}
