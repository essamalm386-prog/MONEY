package com.essama.dresscode.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.essama.dresscode.charte.Espace
import com.essama.dresscode.charte.Icone
import com.essama.dresscode.charte.IconeSymbole
import com.essama.dresscode.charte.Rayon
import com.essama.dresscode.charte.Taille

/*
 * Les quelques briques que plusieurs ecrans partagent. Rien ici ne
 * decide d'une couleur : tout vient du ColorScheme.
 */

/**
 * Un bloc de l'ecran d'accueil : un chiffre, ce qu'il compte, et ou
 * il mene. L'ecran doit se lire en trois secondes — d'ou un chiffre
 * par bloc et rien d'autre.
 */
@Composable
fun BlocResume(
    compte: String,
    libelle: String,
    icone: Icone,
    modifier: Modifier = Modifier,
    detail: String? = null,
    fond: Color = MaterialTheme.colorScheme.surfaceVariant,
    encre: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    surClic: () -> Unit,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(fond, RoundedCornerShape(Rayon.xl))
            .clickable(onClick = surClic)
            .padding(horizontal = Espace.six, vertical = Espace.cinq),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Espace.cinq),
    ) {
        Text(
            text = compte,
            style = MaterialTheme.typography.displaySmall,
            color = encre,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = libelle,
                style = MaterialTheme.typography.titleMedium,
                color = encre,
            )
            if (detail != null) {
                Text(
                    text = detail,
                    style = MaterialTheme.typography.bodyMedium,
                    color = encre.copy(alpha = 0.85f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        IconeSymbole(icone = icone, couleur = encre)
    }
}

/** Une ligne de liste cliquable : vignette, texte, echeance. */
@Composable
fun CarteLien(
    titre: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    debut: @Composable (() -> Unit)? = null,
    fin: @Composable (() -> Unit)? = null,
    surClic: () -> Unit,
) {
    Card(
        onClick = surClic,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Rayon.lg),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Row(
            modifier = Modifier.padding(Espace.quatre),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Espace.quatre),
        ) {
            debut?.invoke()
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = titre,
                    style = MaterialTheme.typography.bodyLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (detail != null) {
                    Text(
                        text = detail,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            fin?.invoke()
        }
    }
}

/**
 * Etat vide : dire pourquoi c'est vide et comment le remplir. Le
 * seul endroit ou deux phrases sont legitimes.
 */
@Composable
fun EtatVide(
    icone: Icone,
    titre: String,
    modifier: Modifier = Modifier,
    action: @Composable (() -> Unit)? = null,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Espace.six, vertical = Espace.seize),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Espace.quatre),
    ) {
        IconeSymbole(
            icone = icone,
            taille = Taille.illustration,
            couleur = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = titre,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        action?.invoke()
    }
}

/**
 * Pastille de deux lettres. Personne ne photographie ses clientes,
 * et une liste d'avatars vides serait plus bruyante qu'utile.
 */
@Composable
fun Pastille(nom: String, modifier: Modifier = Modifier, taille: Int = 44) {
    Box(
        modifier = modifier
            .size(taille.dp)
            .background(MaterialTheme.colorScheme.secondaryContainer, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initiales(nom),
            style = if (taille >= 56) {
                MaterialTheme.typography.titleLarge
            } else {
                MaterialTheme.typography.titleSmall
            },
            color = MaterialTheme.colorScheme.onSecondaryContainer,
        )
    }
}

fun initiales(nom: String): String {
    val mots = nom.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (mots.isEmpty()) return "?"
    return (mots[0].take(1) + (mots.getOrNull(1)?.take(1) ?: "")).uppercase()
}

/** Une ligne « libelle / valeur », pour les blocs d'argent et de detail. */
@Composable
fun LigneInfo(
    libelle: String,
    valeur: String,
    modifier: Modifier = Modifier,
    fort: Boolean = false,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = Espace.trois),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = libelle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(Espace.quatre))
        Text(
            text = valeur,
            style = if (fort) {
                MaterialTheme.typography.titleLarge
            } else {
                MaterialTheme.typography.bodyLarge
            },
            color = if (fort) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurface
            },
        )
    }
}
