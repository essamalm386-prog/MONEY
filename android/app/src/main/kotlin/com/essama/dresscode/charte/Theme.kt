package com.essama.dresscode.charte

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

/*
 * Trois etats, comme la version web : preference systeme, force
 * clair, force sombre. Tout passe par le ColorScheme genere depuis
 * tokens.css — aucune couleur n'est choisie ici.
 */

enum class Apparence { Systeme, Clair, Sombre }

@Composable
fun ThemeDressCode(
    apparence: Apparence = Apparence.Systeme,
    contenu: @Composable () -> Unit,
) {
    val sombre = when (apparence) {
        Apparence.Systeme -> isSystemInDarkTheme()
        Apparence.Clair -> false
        Apparence.Sombre -> true
    }
    MaterialTheme(
        colorScheme = if (sombre) schemaSombre else schemaClair,
        typography = typographie,
        shapes = formes,
        content = contenu,
    )
}
