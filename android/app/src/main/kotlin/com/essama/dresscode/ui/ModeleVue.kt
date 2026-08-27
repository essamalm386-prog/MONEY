package com.essama.dresscode.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.essama.dresscode.DressCodeApplication
import com.essama.dresscode.charte.Apparence
import com.essama.dresscode.donnees.Depot
import com.essama.dresscode.metier.Atelier
import com.essama.dresscode.metier.Client
import com.essama.dresscode.metier.Commande
import com.essama.dresscode.metier.ModeleCatalogue
import com.essama.dresscode.metier.ResumeDuJour
import com.essama.dresscode.metier.resumeDuJour
import com.essama.dresscode.rappel.Rappel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/*
 * Un seul modele de vue pour toute l'application.
 *
 * Le volume de donnees d'un atelier — quelques centaines de fiches —
 * tient largement en memoire. Un modele par ecran multiplierait les
 * observations sur la meme base sans rien apporter, et compliquerait
 * les gestes qui traversent plusieurs ecrans : creer une commande
 * touche a la fois la cliente, la commande et le catalogue.
 */
class ModeleVue(application: Application) : AndroidViewModel(application) {

    val depot: Depot = (application as DressCodeApplication).depot

    val clients: StateFlow<List<Client>> = depot.clients.enEtat(emptyList())
    val commandes: StateFlow<List<Commande>> = depot.commandes.enEtat(emptyList())
    val modeles: StateFlow<List<ModeleCatalogue>> = depot.modeles.enEtat(emptyList())
    val atelier: StateFlow<Atelier> = depot.reglages.atelier.enEtat(Atelier())

    val resume: StateFlow<ResumeDuJour> =
        depot.commandes.map { resumeDuJour(it) }.enEtat(ResumeDuJour())

    /** Les commandes d'une cliente, avec la cliente elle-meme. */
    fun fiche(clientId: Long) = combine(
        depot.client(clientId),
        depot.commandesDuClient(clientId),
        depot.dernierEnvoi(clientId),
    ) { client, commandes, envoi -> Triple(client, commandes, envoi) }

    fun commande(id: Long) = depot.commande(id)

    // ---------- Ecritures ----------

    fun enregistrerAtelier(atelier: Atelier) = viewModelScope.launch {
        depot.reglages.enregistrerAtelier(atelier)
        /* L'heure du rappel a pu changer : reprogrammer tout de suite,
           sinon le prochain resume partirait a l'ancienne heure. */
        Rappel.replanifier(getApplication(), atelier.heureRappel)
    }

    fun enregistrerApparence(apparence: Apparence) = viewModelScope.launch {
        depot.reglages.enregistrerApparence(apparence)
    }

    fun enregistrerClient(client: Client, apres: (Long) -> Unit = {}) = viewModelScope.launch {
        apres(depot.enregistrerClient(client))
    }

    fun supprimerClient(client: Client, apres: () -> Unit = {}) = viewModelScope.launch {
        depot.supprimerClient(client)
        apres()
    }

    fun mettreAJourCommande(commande: Commande) = viewModelScope.launch {
        depot.mettreAJourCommande(commande)
    }

    fun supprimerCommande(commande: Commande, apres: () -> Unit = {}) = viewModelScope.launch {
        depot.supprimerCommande(commande)
        apres()
    }

    fun avancer(commande: Commande, soldeRegle: Boolean? = null, apres: (Commande) -> Unit = {}) =
        viewModelScope.launch {
            depot.avancer(commande, soldeRegle)?.let(apres)
        }

    fun enregistrerModele(modele: ModeleCatalogue) = viewModelScope.launch {
        depot.enregistrerModele(modele)
    }

    fun supprimerModele(modele: ModeleCatalogue) = viewModelScope.launch {
        depot.supprimerModele(modele)
    }

    fun noterEnvoi(clientId: Long, type: String, nombre: Int = 1) = viewModelScope.launch {
        depot.noterEnvoi(clientId, type, nombre)
    }

    private fun <T> kotlinx.coroutines.flow.Flow<T>.enEtat(initial: T): StateFlow<T> =
        stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)

    companion object {
        val Fabrique = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(
                classe: Class<T>,
                extras: androidx.lifecycle.viewmodel.CreationExtras,
            ): T {
                val application = extras[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]!!
                return ModeleVue(application) as T
            }
        }
    }
}
