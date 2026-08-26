package com.essama.dresscode.ui.ecrans

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.item
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.navigation.NavHostController
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille
import com.essama.dresscode.metier.Ligne
import com.essama.dresscode.metier.dateLongue
import com.essama.dresscode.metier.majusculeInitiale
import com.essama.dresscode.metier.montant
import com.essama.dresscode.ui.BlocResume
import com.essama.dresscode.ui.ModeleVue
import com.essama.dresscode.ui.Route
import java.time.LocalDate

/*
 * L'ecran d'ouverture. Le couturier voit sa journee sans rien
 * chercher : un bloc par chose a faire, un chiffre par bloc, chaque
 * bloc ouvre la liste correspondante.
 *
 * Le test : en trois secondes, sans lire attentivement, savoir s'il
 * est en retard. Tout ce qui demande un effort de lecture n'a pas sa
 * place ici — ni graphique, ni statistique, ni menu a explorer.
 */
@Composable
fun EcranAujourdhui(modeleVue: ModeleVue, navigation: NavHostController) {
    val resume by modeleVue.resume.collectAsState()
    val clients by modeleVue.clients.collectAsState()
    val commandes by modeleVue.commandes.collectAsState()
    val atelier by modeleVue.atelier.collectAsState()

    val nomDe = { clientId: Long -> clients.firstOrNull { it.id == clientId }?.nom ?: "Cliente" }

    /* Un chiffre seul dit qu'il y a un probleme ; un nom dit lequel. */
    val noms = { lignes: List<Ligne> ->
        val cites = lignes.take(2).map { "${it.commande.modeleNom} — ${nomDe(it.commande.clientId)}" }
        val reste = lignes.size - cites.size
        cites.joinToString(" · ") + if (reste > 0) " · +$reste" else ""
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = Espace.quatre,
            end = Espace.quatre,
            top = Espace.six,
            bottom = Espace.seize,
        ),
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        item {
            Column(modifier = Modifier.padding(bottom = Espace.deux)) {
                Text("Aujourd’hui", style = MaterialTheme.typography.headlineLarge)
                Text(
                    text = dateLongue(LocalDate.now()).majusculeInitiale(),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        /* Tant que la fiche atelier est vide, le recapitulatif
           partirait sans nom ni numero — donc sans le seul canal
           d'acquisition gratuit du produit. */
        if (atelier.nom.isBlank()) {
            item {
                BlocResume(
                    compte = "",
                    libelle = "Nom de l’atelier à renseigner",
                    detail = "Il apparaît sur les fiches envoyées aux clientes.",
                    icone = Icones.Storefront,
                    fond = MaterialTheme.colorScheme.primaryContainer,
                    encre = MaterialTheme.colorScheme.onPrimaryContainer,
                    surClic = { navigation.navigate(Route.Atelier.chemin) },
                )
            }
        }

        if (commandes.isEmpty()) {
            item {
                com.essama.dresscode.ui.EtatVide(
                    icone = Icones.Checkroom,
                    titre = "Aucune commande pour l’instant.",
                    action = {
                        Button(onClick = { navigation.navigate(Route.nouvelleCommande()) }) {
                            IconeSymbole(icone = Icones.Add, taille = Taille.petite)
                            Text("  Première commande")
                        }
                    },
                )
            }
            return@LazyColumn
        }

        if (resume.retard.isNotEmpty()) {
            item {
                BlocResume(
                    compte = resume.retard.size.toString(),
                    libelle = if (resume.retard.size == 1) "commande en retard" else "commandes en retard",
                    detail = noms(resume.retard),
                    icone = Icones.PriorityHigh,
                    /* Le rouge ne sert qu'a ca. S'il servait aussi
                       d'accent, il ne voudrait plus rien dire. */
                    fond = MaterialTheme.colorScheme.errorContainer,
                    encre = MaterialTheme.colorScheme.onErrorContainer,
                    surClic = { navigation.navigate(Route.commandes("retard")) },
                )
            }
        }

        if (resume.livraisons.isNotEmpty()) {
            item {
                BlocResume(
                    compte = resume.livraisons.size.toString(),
                    libelle = if (resume.livraisons.size == 1) "livraison aujourd’hui" else "livraisons aujourd’hui",
                    detail = noms(resume.livraisons),
                    icone = Icones.Inventory2,
                    fond = MaterialTheme.colorScheme.primaryContainer,
                    encre = MaterialTheme.colorScheme.onPrimaryContainer,
                    surClic = { navigation.navigate(Route.commandes("aujourdhui")) },
                )
            }
        }

        if (resume.aCommencer.isNotEmpty()) {
            item {
                BlocResume(
                    compte = resume.aCommencer.size.toString(),
                    libelle = if (resume.aCommencer.size == 1) "vêtement à commencer" else "vêtements à commencer",
                    detail = "pour tenir les délais de la semaine",
                    icone = Icones.ContentCut,
                    surClic = { navigation.navigate(Route.commandes("a_commencer")) },
                )
            }
        }

        if (resume.enConfection.isNotEmpty()) {
            item {
                BlocResume(
                    compte = resume.enConfection.size.toString(),
                    libelle = "en cours de confection",
                    icone = Icones.Iron,
                    surClic = { navigation.navigate(Route.commandes("en_confection")) },
                )
            }
        }

        if (resume.pretes.isNotEmpty()) {
            item {
                BlocResume(
                    compte = resume.pretes.size.toString(),
                    libelle = if (resume.pretes.size == 1) "prête à récupérer" else "prêtes à récupérer",
                    detail = "la cliente peut être prévenue",
                    icone = Icones.CheckCircle,
                    surClic = { navigation.navigate(Route.commandes("prete")) },
                )
            }
        }

        if (resume.calme && resume.enConfection.isEmpty() && resume.pretes.isEmpty()) {
            item { JourneeCalme(resume.enCours) }
        }

        if (resume.aEncaisser > 0) {
            item {
                /* Le bloc argent se distingue par sa forme, pas par une
                   quatrieme couleur : un rose voisin du rouge d'erreur
                   brouillerait le seul signal qui doit rester unique. */
                BlocResume(
                    compte = montant(resume.aEncaisser),
                    libelle = "Reste à encaisser",
                    detail = "sur ${resume.nbImpayees} commande${if (resume.nbImpayees > 1) "s" else ""}",
                    icone = Icones.Payments,
                    fond = MaterialTheme.colorScheme.surface,
                    encre = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = Espace.quatre),
                    surClic = { navigation.navigate(Route.commandes("impayees")) },
                )
            }
        }
    }
}

@Composable
private fun JourneeCalme(enCours: Int) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = Espace.douze, horizontal = Espace.six),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        IconeSymbole(
            icone = Icones.SentimentSatisfied,
            taille = Taille.illustration,
            couleur = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("Rien d’urgent aujourd’hui", style = MaterialTheme.typography.titleMedium)
        Text(
            text = if (enCours > 0) {
                "$enCours commande${if (enCours > 1) "s" else ""} en cours, aucune échéance proche."
            } else {
                "Aucune commande en cours."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}
