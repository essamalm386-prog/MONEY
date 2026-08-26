package com.essama.dresscode.ui.ecrans

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.navigation.NavHostController
import coil.compose.AsyncImage
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Cadence
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.Mesure
import com.essama.dresscode.metier.correspondA
import com.essama.dresscode.metier.dateLongue
import com.essama.dresscode.metier.majusculeInitiale
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Route
import kotlinx.coroutines.launch
import java.time.LocalDate

/*
 * L'ecran qui decide de l'adoption.
 *
 * Le concurrent n'est pas une autre application, c'est un stylo :
 * noter une commande au cahier prend quinze secondes. L'objectif ici
 * est une minute, cliente devant soi, sans jamais quitter l'ecran.
 *
 * D'ou trois partis pris : un seul ecran qui defile, sans etape a
 * valider ; ce qui est connu est deja rempli ; et les saisies
 * frequentes sont des appuis, pas des frappes.
 */
@Composable
fun EcranNouvelleCommande(
    modeleVue: ModeleVue,
    navigation: NavHostController,
    clientPreselectionne: Long?,
    message: (String) -> Unit,
) {
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val clients by modeleVue.clients.collectAsState()

    var client by remember(clientPreselectionne, clients) {
        mutableStateOf(clients.firstOrNull { it.id == clientPreselectionne })
    }
    var nouveauNom by remember { mutableStateOf("") }
    var nouveauTelephone by remember { mutableStateOf("") }
    var recherche by remember { mutableStateOf("") }

    var mesures by remember(client) {
        mutableStateOf(client?.mesures?.mapValues { it.value } ?: emptyMap())
    }
    var mesuresEtendues by remember { mutableStateOf(false) }

    var modeleNom by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<String?>(null) }
    var livraison by remember { mutableStateOf<LocalDate?>(null) }
    var cadence by remember { mutableStateOf(Cadence.NORMALE) }
    var prixTotal by remember { mutableStateOf("") }
    var acompte by remember { mutableStateOf("") }

    val choisirPhoto = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia(),
    ) { adresse ->
        if (adresse != null) {
            portee.launch { photo = modeleVue.depot.photos.enregistrer(adresse) }
        }
    }

    val nombre = { texte: String -> texte.filter(Char::isDigit).toLongOrNull() ?: 0L }
    val reste = (nombre(prixTotal) - nombre(acompte)).coerceAtLeast(0)

    LazyColumn(
        contentPadding = PaddingValues(
            start = Espace.quatre, end = Espace.quatre,
            top = Espace.six, bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        item { Text("Nouvelle commande", style = MaterialTheme.typography.headlineMedium) }

        // ---------- 1. Cliente ----------
        item {
            Etape(1, "Cliente", client != null || nouveauNom.isNotBlank()) {
                val choisie = client
                if (choisie != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text(choisie.nom, style = MaterialTheme.typography.bodyLarge)
                            Text(
                                choisie.telephone.ifBlank { "Numéro non renseigné" },
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        androidx.compose.material3.TextButton(onClick = {
                            client = null
                            mesures = emptyMap()
                        }) { Text("Changer") }
                    }
                } else {
                    OutlinedTextField(
                        value = recherche,
                        onValueChange = { recherche = it },
                        label = { Text("Chercher une cliente") },
                        leadingIcon = { IconeSymbole(icone = Icones.Search) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (recherche.isNotBlank()) {
                        clients.filter { it.correspondA(recherche) }.take(5).forEach { candidate ->
                            CarteLien(
                                titre = candidate.nom,
                                detail = candidate.telephone,
                                modifier = Modifier.padding(top = Espace.deux),
                                surClic = {
                                    client = candidate
                                    mesures = candidate.mesures
                                    recherche = ""
                                },
                            )
                        }
                    }

                    Text(
                        "ou nouvelle cliente",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = Espace.trois),
                    )
                    OutlinedTextField(
                        value = nouveauNom,
                        onValueChange = { nouveauNom = it },
                        label = { Text("Nom") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = nouveauTelephone,
                        onValueChange = { nouveauTelephone = it },
                        label = { Text("Téléphone") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = Espace.trois),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = KeyboardType.Phone,
                        ),
                    )
                }
            }
        }

        // ---------- 2. Mesures ----------
        item {
            Etape(2, "Mesures", mesures.values.any { it.isNotBlank() }) {
                if (client != null && client!!.mesures.isNotEmpty()) {
                    Text(
                        "Reprises de la fiche, modifiables.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = Espace.trois),
                    )
                }
                val liste = if (mesuresEtendues) Mesure.entries else Mesure.base
                liste.forEach { mesure ->
                    OutlinedTextField(
                        value = mesures[mesure].orEmpty(),
                        onValueChange = { mesures = mesures + (mesure to it) },
                        label = { Text(mesure.libelle) },
                        suffix = { Text("cm") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(bottom = Espace.deux),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = KeyboardType.Decimal,
                        ),
                    )
                }
                if (!mesuresEtendues) {
                    androidx.compose.material3.TextButton(onClick = { mesuresEtendues = true }) {
                        Text("Plus de mesures")
                    }
                }
            }
        }

        // ---------- 3. Modele ----------
        item {
            Etape(3, "Modèle", modeleNom.isNotBlank()) {
                photo?.let { nom ->
                    AsyncImage(
                        model = modeleVue.depot.photos.fichier(nom),
                        contentDescription = "Modèle commandé",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(4f / 3f)
                            .clip(RoundedCornerShape(Rayon.lg))
                            .padding(bottom = Espace.trois),
                    )
                }
                OutlinedTextField(
                    value = modeleNom,
                    onValueChange = { modeleNom = it },
                    label = { Text("Nom du modèle") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedButton(
                    onClick = {
                        choisirPhoto.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                        )
                    },
                    modifier = Modifier.padding(top = Espace.trois),
                ) {
                    IconeSymbole(icone = Icones.AddPhotoAlternate, taille = Taille.petite)
                    Text("  ${if (photo == null) "Ajouter une photo" else "Changer la photo"}")
                }
            }
        }

        // ---------- 4. Livraison ----------
        item {
            Etape(4, "Livraison", livraison != null) {
                /* Les echeances proposees sont celles qu'un couturier
                   annonce a l'oral. Le calendrier reste pour le reste. */
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Espace.deux),
                ) {
                    listOf(
                        "Demain" to 1L,
                        "Dans 3 jours" to 3L,
                        "Dans 1 semaine" to 7L,
                    ).forEach { (libelle, jours) ->
                        val date = LocalDate.now().plusDays(jours)
                        FilterChip(
                            selected = livraison == date,
                            onClick = { livraison = date },
                            label = { Text(libelle) },
                        )
                    }
                }
                livraison?.let {
                    Text(
                        dateLongue(it).majusculeInitiale(),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = Espace.trois),
                    )
                }

                Text(
                    "Temps de confection",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(top = Espace.quatre, bottom = Espace.deux),
                )
                Text(
                    "Décide du moment où l’application prévient de commencer.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = Espace.deux),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Espace.deux)) {
                    Cadence.entries.forEach { candidate ->
                        FilterChip(
                            selected = cadence == candidate,
                            onClick = { cadence = candidate },
                            label = { Text(candidate.libelle) },
                        )
                    }
                }
                Text(
                    cadence.exemple,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = Espace.deux),
                )
            }
        }

        // ---------- 5. Prix ----------
        item {
            Etape(5, "Prix", nombre(prixTotal) > 0) {
                OutlinedTextField(
                    value = prixTotal,
                    onValueChange = { prixTotal = it.filter(Char::isDigit) },
                    label = { Text("Prix total") },
                    suffix = { Text("F") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                    ),
                )
                OutlinedTextField(
                    value = acompte,
                    onValueChange = { acompte = it.filter(Char::isDigit) },
                    label = { Text("Avance versée") },
                    suffix = { Text("F") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(top = Espace.trois),
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                    ),
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Espace.quatre),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Espace.quatre),
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Reste à payer",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(montant(reste), style = MaterialTheme.typography.titleMedium)
                }
                Button(
                    onClick = {
                        /* Deux informations sont indispensables : qui,
                           et pour quand. Tout le reste se complete
                           depuis la fiche — bloquer sur un prix
                           manquant ferait perdre la commande. */
                        val nom = client?.nom ?: nouveauNom.trim()
                        if (nom.isBlank()) {
                            message("Nom de la cliente manquant")
                            return@Button
                        }
                        val date = livraison
                        if (date == null) {
                            message("Date de livraison manquante")
                            return@Button
                        }
                        portee.launch {
                            val propres = mesures.filterValues { it.isNotBlank() }
                            val existante = client
                                ?: modeleVue.depot.clientParNumero(nouveauTelephone)
                            val aEnregistrer = (existante ?: Client(nom = nom)).copy(
                                nom = if (existante != null) existante.nom else nom,
                                telephone = existante?.telephone?.ifBlank { nouveauTelephone }
                                    ?: nouveauTelephone,
                                mesures = propres.ifEmpty { existante?.mesures ?: emptyMap() },
                                mesuresMajLe = if (propres.isNotEmpty()) {
                                    System.currentTimeMillis()
                                } else {
                                    existante?.mesuresMajLe
                                },
                            )
                            val clientId = modeleVue.depot.enregistrerClient(aEnregistrer)

                            val identifiant = modeleVue.depot.ajouterCommande(
                                Commande(
                                    clientId = clientId,
                                    modeleNom = modeleNom.ifBlank { "Commande" },
                                    photo = photo,
                                    mesures = propres,
                                    cadence = cadence,
                                    dateCommande = LocalDate.now(),
                                    dateLivraison = date,
                                    prixTotal = nombre(prixTotal),
                                    acompte = nombre(acompte),
                                    soldeRegle = nombre(prixTotal) > 0 &&
                                        nombre(acompte) >= nombre(prixTotal),
                                ),
                            )
                            message("Commande enregistrée")
                            /* On atterrit sur la fiche : le geste
                               suivant, c'est l'envoi du recapitulatif
                               a la cliente, tant qu'elle est encore la. */
                            navigation.navigate(Route.commande(identifiant)) {
                                popUpTo(Route.NouvelleCommande.chemin) { inclusive = true }
                            }
                        }
                    },
                ) {
                    IconeSymbole(icone = Icones.Check, taille = Taille.petite)
                    Text("  Enregistrer")
                }
            }
        }
    }
}

/* Les etapes sont des reperes visuels, pas des pages : rien
   n'oblige a valider pour passer a la suivante. */
@Composable
private fun Etape(
    numero: Int,
    titre: String,
    remplie: Boolean,
    contenu: @Composable () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Rayon.xl),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
        border = androidx.compose.foundation.BorderStroke(
            1.dp(),
            MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Column(modifier = Modifier.padding(Espace.cinq)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Espace.trois),
                modifier = Modifier.padding(bottom = Espace.quatre),
            ) {
                Text(
                    text = if (remplie) "✓" else numero.toString(),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (remplie) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
                Text(titre, style = MaterialTheme.typography.titleMedium)
            }
            contenu()
        }
    }
}

private fun Int.dp() = androidx.compose.ui.unit.Dp(this.toFloat())
