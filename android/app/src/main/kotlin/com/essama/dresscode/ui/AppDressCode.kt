package com.essama.dresscode.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Icones
import com.essama.dresscode.donnees.Depot
import com.essama.dresscode.ui.ecrans.EcranAtelier
import com.essama.dresscode.ui.ecrans.EcranAujourdhui
import com.essama.dresscode.ui.ecrans.EcranClient
import com.essama.dresscode.ui.ecrans.EcranClients
import com.essama.dresscode.ui.ecrans.EcranCommande
import com.essama.dresscode.ui.ecrans.EcranCommandes
import com.essama.dresscode.ui.ecrans.EcranModeles
import com.essama.dresscode.ui.ecrans.EcranNouvelleCommande
import kotlinx.coroutines.launch

/*
 * La coquille : navigation basse, bouton d'action, messages.
 *
 * Le bouton flottant porte l'action principale de l'ecran ou il
 * apparait. Sur le catalogue, ajouter une commande n'aurait aucun
 * sens : c'est un modele qu'on ajoute.
 */

@Composable
fun AppDressCode(depot: Depot) {
    val navigation = rememberNavController()
    val modeleVue: ModeleVue = viewModel(factory = ModeleVue.Fabrique)
    val messages = remember { SnackbarHostState() }
    val portee = rememberCoroutineScope()

    val entree by navigation.currentBackStackEntryAsState()
    val routeCourante = entree?.destination?.route

    val montrerNavigation = routeCourante in sections.map { racine(it.route) } ||
        routeCourante == Route.Commandes.chemin

    val message: (String) -> Unit = { texte ->
        portee.launch { messages.showSnackbar(texte) }
    }

    Scaffold(
        bottomBar = {
            if (montrerNavigation) {
                BarreNavigation(navigation, routeCourante)
            }
        },
        floatingActionButton = {
            BoutonAction(routeCourante, navigation, modeleVue)
        },
        snackbarHost = { SnackbarHost(messages) },
    ) { marges ->
        NavHost(
            navController = navigation,
            startDestination = Route.Aujourdhui.chemin,
            modifier = Modifier.fillMaxSize().padding(marges),
        ) {
            composable(Route.Aujourdhui.chemin) {
                EcranAujourdhui(modeleVue, navigation)
            }
            composable(
                Route.Commandes.chemin,
                arguments = listOf(
                    navArgument("filtre") {
                        type = NavType.StringType
                        defaultValue = "en_cours"
                    },
                ),
            ) { entree ->
                EcranCommandes(
                    modeleVue = modeleVue,
                    navigation = navigation,
                    filtreInitial = entree.arguments?.getString("filtre") ?: "en_cours",
                )
            }
            composable(Route.Clients.chemin) {
                EcranClients(modeleVue, navigation)
            }
            composable(Route.Modeles.chemin) {
                EcranModeles(modeleVue, message)
            }
            composable(Route.Atelier.chemin) {
                EcranAtelier(modeleVue, navigation, message)
            }
            composable(
                Route.NouvelleCommande.chemin,
                arguments = listOf(
                    navArgument("client") {
                        type = NavType.LongType
                        defaultValue = -1L
                    },
                ),
            ) { entree ->
                EcranNouvelleCommande(
                    modeleVue = modeleVue,
                    navigation = navigation,
                    clientPreselectionne = entree.arguments?.getLong("client")?.takeIf { it > 0 },
                    message = message,
                )
            }
            composable(
                Route.Commande.chemin,
                arguments = listOf(navArgument("id") { type = NavType.LongType }),
            ) { entree ->
                EcranCommande(
                    modeleVue = modeleVue,
                    navigation = navigation,
                    commandeId = entree.arguments?.getLong("id") ?: 0L,
                    message = message,
                )
            }
            composable(
                Route.Client.chemin,
                arguments = listOf(navArgument("id") { type = NavType.LongType }),
            ) { entree ->
                EcranClient(
                    modeleVue = modeleVue,
                    navigation = navigation,
                    clientId = entree.arguments?.getLong("id") ?: 0L,
                    message = message,
                )
            }
        }
    }
}

/** La partie de la route avant ses parametres. */
private fun racine(route: String) = route.substringBefore('?')

@Composable
private fun BarreNavigation(navigation: NavHostController, routeCourante: String?) {
    NavigationBar {
        sections.forEach { section ->
            val actif = racine(routeCourante ?: "") == racine(section.route)
            NavigationBarItem(
                selected = actif,
                onClick = {
                    navigation.navigate(section.route) {
                        /* Revenir a l'accueil plutot qu'empiler les
                           onglets : le bouton retour du telephone doit
                           sortir de l'application, pas remonter huit
                           onglets. */
                        popUpTo(navigation.graph.findStartDestination().id) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                },
                icon = { IconeSymbole(icone = section.icone, remplie = actif) },
                label = { Text(section.libelle) },
            )
        }
    }
}

@Composable
private fun BoutonAction(
    routeCourante: String?,
    navigation: NavHostController,
    modeleVue: ModeleVue,
) {
    val racine = racine(routeCourante ?: "")
    when (racine) {
        Route.Aujourdhui.chemin, "commandes", Route.Clients.chemin -> {
            ExtendedFloatingActionButton(
                onClick = { navigation.navigate(Route.nouvelleCommande()) },
                icon = { IconeSymbole(icone = Icones.Add) },
                text = { Text("Commande") },
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
        /* Le catalogue a son propre bouton, pose par l'ecran :
           l'action ouvre une feuille, pas une route. */
        else -> Unit
    }
}
