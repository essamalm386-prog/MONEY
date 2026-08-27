package com.essama.dresscode.ui

/*
 * Quatre sections a portee de pouce, le reste s'atteint depuis
 * elles. Les identifiants sont regroupes ici pour qu'une route ne
 * s'ecrive jamais deux fois a la main.
 */

import com.essama.dresscode.charte.Icone
import com.essama.dresscode.charte.Icones

sealed interface Route {
    val chemin: String

    data object Aujourdhui : Route { override val chemin = "aujourdhui" }
    data object Commandes : Route { override val chemin = "commandes?filtre={filtre}" }
    data object Clients : Route { override val chemin = "clients" }
    data object Modeles : Route { override val chemin = "modeles" }
    data object Atelier : Route { override val chemin = "atelier" }
    data object NouvelleCommande : Route { override val chemin = "commande/nouvelle?client={client}" }
    data object Commande : Route { override val chemin = "commande/{id}" }
    data object Client : Route { override val chemin = "client/{id}" }

    companion object {
        fun commandes(filtre: String = "en_cours") = "commandes?filtre=$filtre"
        fun nouvelleCommande(clientId: Long? = null) =
            "commande/nouvelle?client=${clientId ?: -1L}"
        fun commande(id: Long) = "commande/$id"
        fun client(id: Long) = "client/$id"
    }
}

data class Section(
    val route: String,
    val libelle: String,
    val icone: Icone,
)

val sections = listOf(
    Section(Route.Aujourdhui.chemin, "Aujourd’hui", Icones.Today),
    Section(Route.commandes(), "Commandes", Icones.Checkroom),
    Section(Route.Clients.chemin, "Clientes", Icones.Group),
    Section(Route.Modeles.chemin, "Modèles", Icones.PhotoLibrary),
)
