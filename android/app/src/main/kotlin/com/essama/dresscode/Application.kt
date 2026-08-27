package com.essama.dresscode

import android.app.Application
import com.essama.dresscode.donnees.Depot
import com.essama.dresscode.rappel.Rappel

class DressCodeApplication : Application() {

    /* Un seul depot pour toute l'application : ouvrir la base deux
       fois couterait une seconde au demarrage sur un telephone lent. */
    val depot: Depot by lazy { Depot(this) }

    override fun onCreate() {
        super.onCreate()
        Rappel.creerCanal(this)
        Rappel.replanifier(this)
    }
}
