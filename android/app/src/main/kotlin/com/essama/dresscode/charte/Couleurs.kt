package com.essama.dresscode.charte

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/*
 * Genere par outils/generer-theme-compose.mjs — ne pas modifier a la main.
 *
 * Les 29 roles viennent de design/tokens/tokens.css, produit par
 * l'algorithme HCT de Google a partir de la couleur de marque #3f3d9e.
 * Les contrastes sont garantis par construction tant qu'on pose
 * « onX » sur « X » : ne jamais choisir une couleur a la main.
 */

private val ClairSchema = lightColorScheme(
    primary = Color(0xFF5452B4),
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFE2DFFF),
    onPrimaryContainer = Color(0xFF0C006A),
    secondary = Color(0xFF5D5C71),
    onSecondary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFE3E0F9),
    onSecondaryContainer = Color(0xFF1A1A2C),
    tertiary = Color(0xFF7A5368),
    onTertiary = Color(0xFFFFFFFF),
    tertiaryContainer = Color(0xFFFFD8EB),
    onTertiaryContainer = Color(0xFF2F1124),
    error = Color(0xFFBA1A1A),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
    background = Color(0xFFFFFBFF),
    onBackground = Color(0xFF1C1B1F),
    surface = Color(0xFFFFFBFF),
    onSurface = Color(0xFF1C1B1F),
    surfaceVariant = Color(0xFFE4E1EC),
    onSurfaceVariant = Color(0xFF47464F),
    outline = Color(0xFF787680),
    outlineVariant = Color(0xFFC8C5D0),
    scrim = Color(0xFF000000),
    inverseSurface = Color(0xFF313034),
    inverseOnSurface = Color(0xFFF3EFF4),
    inversePrimary = Color(0xFFC2C1FF),
)

private val SombreSchema = darkColorScheme(
    primary = Color(0xFFC2C1FF),
    onPrimary = Color(0xFF241F83),
    primaryContainer = Color(0xFF3B399A),
    onPrimaryContainer = Color(0xFFE2DFFF),
    secondary = Color(0xFFC6C4DD),
    onSecondary = Color(0xFF2F2F42),
    secondaryContainer = Color(0xFF454559),
    onSecondaryContainer = Color(0xFFE3E0F9),
    tertiary = Color(0xFFEAB9D2),
    onTertiary = Color(0xFF472639),
    tertiaryContainer = Color(0xFF603C50),
    onTertiaryContainer = Color(0xFFFFD8EB),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFB4AB),
    background = Color(0xFF1C1B1F),
    onBackground = Color(0xFFE5E1E6),
    surface = Color(0xFF1C1B1F),
    onSurface = Color(0xFFE5E1E6),
    surfaceVariant = Color(0xFF47464F),
    onSurfaceVariant = Color(0xFFC8C5D0),
    outline = Color(0xFF918F9A),
    outlineVariant = Color(0xFF47464F),
    scrim = Color(0xFF000000),
    inverseSurface = Color(0xFFE5E1E6),
    inverseOnSurface = Color(0xFF313034),
    inversePrimary = Color(0xFF5452B4),
)

internal val schemaClair: ColorScheme = ClairSchema
internal val schemaSombre: ColorScheme = SombreSchema
