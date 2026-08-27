package com.essama.dresscode.ui.ecrans

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
import com.essama.dresscode.metier.correspondA
import com.essama.dresscode.metier.dateLongue
import com.essama.dresscode.metier.majusculeInitiale
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.CarteLien
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Route
import kotlinx.coroutines.launch
import java.time.LocalDate
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.platform.testTag
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.libelleMesure
import com.essama.dresscode.metier.mesuresOrdonnees

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
@OptIn(ExperimentalMaterial3Api::class)
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
    val modeles by modeleVue.modeles.collectAsState()

    /* La preselection ne s'applique qu'une fois. Garder « clients »
       comme clef de remember reinitialisait la cliente a chaque
       emission de la liste — c'est-a-dire juste apres avoir
       enregistre une commande, au moment precis ou l'on veut la
       garder pour la suivante de la famille. */
    var client by remember { mutableStateOf<Client?>(null) }
    var preselectionFaite by remember { mutableStateOf(false) }
    LaunchedEffect(clientPreselectionne, clients) {
        if (!preselectionFaite && clientPreselectionne != null) {
            clients.firstOrNull { it.id == clientPreselectionne }?.let {
                client = it
                preselectionFaite = true
            }
        }
    }
    var nouveauNom by remember { mutableStateOf("") }
    var nouveauTelephone by remember { mutableStateOf("") }
    var recherche by remember { mutableStateOf("") }

    var mesures: Map<String, String> by remember(client) {
        mutableStateOf(client?.mesures.orEmpty())
    }
    var mesuresOuvertes by remember { mutableStateOf(false) }

    var modeleNom by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<String?>(null) }
    var modeleChoisi by remember { mutableStateOf<Long?>(null) }
    var catalogueOuvert by remember { mutableStateOf(false) }
    var calendrierOuvert by remember { mutableStateOf(false) }
    var photoAgrandie by remember { mutableStateOf<String?>(null) }
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
        modifier = Modifier.testTag("liste-nouvelle-commande"),
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
                val prises = mesuresOrdonnees(mesures)
                if (prises.isEmpty()) {
                    Text(
                        "Pas encore prises. Elles peuvent aussi venir plus tard.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = Espace.trois),
                    )
                } else {
                    /* Les mesures se lisent d'un coup d'oeil : le
                       couturier verifie qu'elles sont la, il ne les
                       ressaisit que s'il les reprend. */
                    if (client?.mesures?.isNotEmpty() == true) {
                        Text(
                            "Reprises de la fiche.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    prises.chunked(2).forEach { paire ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = Espace.deux),
                            horizontalArrangement = Arrangement.spacedBy(Espace.trois),
                        ) {
                            paire.forEach { (cle, valeur) ->
                                Text(
                                    "${libelleMesure(cle)} $valeur cm",
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            if (paire.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
                OutlinedButton(
                    onClick = { mesuresOuvertes = true },
                    modifier = Modifier.padding(top = Espace.trois).testTag("prendre-mesures"),
                ) {
                    IconeSymbole(icone = Icones.Straighten, taille = Taille.petite)
                    Text(if (prises.isEmpty()) "  Prendre les mesures" else "  Modifier")
                }
            }
        }

        // ---------- 3. Modele ----------
        item {
            Etape(3, "Modèle", modeleNom.isNotBlank()) {
                /* La photo se regarde en grand d'un appui : c'est
                   ainsi qu'on verifie qu'on a pris le bon modele, et
                   qu'on le montre a la cliente en face de soi. */
                photo?.let { nom ->
                    AsyncImage(
                        model = modeleVue.depot.photos.fichier(nom),
                        contentDescription = "Modèle commandé — appuyer pour agrandir",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(4f / 3f)
                            .clip(RoundedCornerShape(Rayon.lg))
                            .clickable { photoAgrandie = nom }
                            .padding(bottom = Espace.trois),
                    )
                }
                OutlinedTextField(
                    value = modeleNom,
                    onValueChange = {
                        modeleNom = it
                        /* Un nom retouche a la main detache la commande
                           du modele du catalogue : elle ne doit plus
                           passer pour lui. */
                        modeleChoisi = null
                    },
                    label = { Text("Nom du modèle") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = Espace.trois),
                    horizontalArrangement = Arrangement.spacedBy(Espace.deux),
                ) {
                    /* Le catalogue en premier : au bout de deux mois,
                       le modele demande y est presque toujours deja, et
                       le choisir remplit nom, photo et prix d'un coup. */
                    if (modeles.isNotEmpty()) {
                        OutlinedButton(
                            onClick = { catalogueOuvert = true },
                            modifier = Modifier.testTag("choisir-modele"),
                        ) {
                            IconeSymbole(icone = Icones.PhotoLibrary, taille = Taille.petite)
                            Text("  Catalogue")
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            choisirPhoto.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                            )
                        },
                    ) {
                        IconeSymbole(icone = Icones.AddPhotoAlternate, taille = Taille.petite)
                        Text("  ${if (photo == null) "Photo" else "Changer"}")
                    }
                }
            }
        }

        // ---------- 4. Livraison ----------
        item {
            Etape(4, "Livraison", livraison != null) {
                /* Les echeances proposees sont celles qu'un couturier
                   annonce a l'oral. Elles couvrent la semaine ; une
                   ceremonie se prepare des mois a l'avance, et c'est
                   le calendrier qui repond a celle-la. */
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
                OutlinedButton(
                    onClick = { calendrierOuvert = true },
                    modifier = Modifier.padding(top = Espace.deux).testTag("choisir-date"),
                ) {
                    IconeSymbole(icone = Icones.CalendarMonth, taille = Taille.petite)
                    Text("  Choisir une date")
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
                val enregistrer: (Boolean) -> Unit = { enchainer ->
                    /* Deux informations sont indispensables : qui, et
                       pour quand. Tout le reste se complete depuis la
                       fiche — bloquer sur un prix manquant ferait
                       perdre la commande. */
                    val nom = client?.nom ?: nouveauNom.trim()
                    val date = livraison
                    when {
                        nom.isBlank() -> message("Nom de la cliente manquant")
                        date == null -> message("Date de livraison manquante")
                        else -> {
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
                            if (enchainer) {
                                /* Une famille pour une ceremonie, c'est
                                   quatre tenues pour la meme date : la
                                   mere, le pere, les enfants. Refaire
                                   le parcours entier a chaque fois, y
                                   compris la date, c'est ce qui fait
                                   ressortir le cahier.

                                   On garde donc l'echeance et la
                                   cadence — ce que la famille a en
                                   commun — et on vide le reste. La
                                   cliente reste choisie mais se change
                                   d'un appui : c'est parfois la meme
                                   personne pour trois tenues, parfois
                                   son mari pour la suivante. */
                                client = existante?.copy(id = clientId)
                                    ?: Client(id = clientId, nom = nom, telephone = nouveauTelephone)
                                nouveauNom = ""
                                nouveauTelephone = ""
                                modeleNom = ""
                                photo = null
                                modeleChoisi = null
                                prixTotal = ""
                                acompte = ""
                                message("Enregistrée — au suivant")
                            } else {
                                message("Commande enregistrée")
                                /* On atterrit sur la fiche : le geste
                                   suivant, c'est l'envoi du recapitulatif
                                   a la cliente, tant qu'elle est encore la. */
                                navigation.navigate(Route.commande(identifiant)) {
                                    popUpTo(Route.NouvelleCommande.chemin) { inclusive = true }
                                }
                            }
                        }
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(Espace.trois)) {
                    Button(
                        onClick = { enregistrer(false) },
                        modifier = Modifier.testTag("enregistrer-commande"),
                    ) {
                        IconeSymbole(icone = Icones.Check, taille = Taille.petite)
                        Text("  Enregistrer")
                    }
                    OutlinedButton(
                        onClick = { enregistrer(true) },
                        modifier = Modifier.testTag("enregistrer-et-suivante"),
                    ) {
                        IconeSymbole(icone = Icones.Add, taille = Taille.petite)
                        Text("  Et une autre")
                    }
                }
            }
        }
    }

    if (mesuresOuvertes) {
        FeuilleMesures(
            titre = client?.nom?.let { "Mesures de $it" } ?: "Mesures",
            mesures = mesures,
            surFermeture = { mesuresOuvertes = false },
            surValidation = {
                mesures = it
                mesuresOuvertes = false
            },
        )
    }

    if (catalogueOuvert) {
        FeuilleCatalogue(
            modeles = modeles,
            fichier = { modeleVue.depot.photos.fichier(it) },
            surFermeture = { catalogueOuvert = false },
            surChoix = { choisi ->
                modeleNom = choisi.nom
                photo = choisi.photo
                modeleChoisi = choisi.id
                /* Le prix indicatif remplit le champ s'il est vide ;
                   il ne remplace jamais un prix deja negocie. */
                if (choisi.prixIndicatif > 0 && prixTotal.isBlank()) {
                    prixTotal = choisi.prixIndicatif.toString()
                }
                catalogueOuvert = false
            },
        )
    }

    if (calendrierOuvert) {
        /* Une echeance passee n'a pas de sens pour une commande qu'on
           prend maintenant : le calendrier commence aujourd'hui. */
        val aujourdhui = LocalDate.now()
        val etatDate = rememberDatePickerState(
            initialSelectedDateMillis = (livraison ?: aujourdhui.plusDays(3))
                .toEpochDay() * 86_400_000L,
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                    utcTimeMillis >= aujourdhui.toEpochDay() * 86_400_000L
            },
        )
        DatePickerDialog(
            onDismissRequest = { calendrierOuvert = false },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = {
                    etatDate.selectedDateMillis?.let {
                        livraison = LocalDate.ofEpochDay(it / 86_400_000L)
                    }
                    calendrierOuvert = false
                }) { Text("Choisir") }
            },
            dismissButton = {
                androidx.compose.material3.TextButton(
                    onClick = { calendrierOuvert = false },
                ) { Text("Annuler") }
            },
        ) {
            DatePicker(state = etatDate)
        }
    }

    photoAgrandie?.let { nom ->
        VisionneusePhoto(
            fichier = modeleVue.depot.photos.fichier(nom),
            description = modeleNom.ifBlank { "Modèle commandé" },
            surFermeture = { photoAgrandie = null },
        )
    }
}

/*
 * Le catalogue, ouvert depuis une commande.
 *
 * Au bout de deux mois d'usage, le modele demande y est presque
 * toujours deja : le choisir remplit le nom, la photo et le prix d'un
 * seul appui, la ou il fallait tout ressaisir.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeuilleCatalogue(
    modeles: List<ModeleCatalogue>,
    fichier: (String) -> java.io.File,
    surFermeture: () -> Unit,
    surChoix: (ModeleCatalogue) -> Unit,
) {
    val etat = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = surFermeture, sheetState = etat) {
        Column(
            modifier = Modifier
                .testTag("feuille-catalogue")
                .fillMaxWidth()
                .padding(horizontal = Espace.quatre)
                .padding(bottom = Espace.huit),
            verticalArrangement = Arrangement.spacedBy(Espace.trois),
        ) {
            Text("Catalogue", style = MaterialTheme.typography.headlineSmall)
            LazyVerticalGrid(
                columns = GridCells.Adaptive(120.dp),
                horizontalArrangement = Arrangement.spacedBy(Espace.trois),
                verticalArrangement = Arrangement.spacedBy(Espace.trois),
                modifier = Modifier.heightIn(max = 420.dp),
            ) {
                items(modeles, key = { it.id }) { modele ->
                    Column(
                        modifier = Modifier.clickable { surChoix(modele) },
                        verticalArrangement = Arrangement.spacedBy(Espace.un),
                    ) {
                        val photo = modele.photo
                        if (photo != null) {
                            AsyncImage(
                                model = fichier(photo),
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
                                    .clip(RoundedCornerShape(Rayon.lg))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                                contentAlignment = Alignment.Center,
                            ) {
                                IconeSymbole(
                                    icone = Icones.Checkroom,
                                    couleur = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Text(
                            modele.nom,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        )
                        if (modele.prixIndicatif > 0) {
                            Text(
                                "à partir de ${montant(modele.prixIndicatif)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
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
            1.dp,
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
