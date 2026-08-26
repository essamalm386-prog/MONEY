package com.essama.dresscode

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.essama.dresscode.charte.Apparence
import com.essama.dresscode.charte.ThemeDressCode
import com.essama.dresscode.ui.AppDressCode

class MainActivity : ComponentActivity() {
    override fun onCreate(etatSauvegarde: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(etatSauvegarde)

        val depot = (application as DressCodeApplication).depot

        setContent {
            val apparence by depot.reglages.apparence.collectAsState(initial = Apparence.Systeme)
            ThemeDressCode(apparence = apparence) {
                AppDressCode(depot = depot)
            }
        }
    }
}
