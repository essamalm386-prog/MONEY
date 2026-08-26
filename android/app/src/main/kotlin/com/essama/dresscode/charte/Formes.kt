package com.essama.dresscode.charte

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

/*
 * Les rayons de la charte. Le defaut d'une carte est 24 dp, plus
 * genereux que le Material Design classique : c'est le marqueur du
 * style Expressive, celui qui donne le ton chaleureux plutot que
 * corporate. Les boutons, eux, sont entierement arrondis.
 */

object Rayon {
    val xs = 4.dp
    val sm = 8.dp
    val md = 12.dp
    val lg = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
    val plein = 999.dp
}

/* Grille de 4 dp : toutes les valeurs en sont des multiples, c'est
   ce qui produit le rythme visuel regulier. En cas de doute, 24 dp. */
object Espace {
    val un = 4.dp
    val deux = 8.dp
    val trois = 12.dp
    val quatre = 16.dp
    val cinq = 20.dp
    val six = 24.dp
    val huit = 32.dp
    val douze = 48.dp
    val seize = 64.dp
}

val formes = Shapes(
    extraSmall = RoundedCornerShape(Rayon.xs),
    small = RoundedCornerShape(Rayon.sm),
    medium = RoundedCornerShape(Rayon.md),
    large = RoundedCornerShape(Rayon.lg),
    extraLarge = RoundedCornerShape(Rayon.xl),
)
