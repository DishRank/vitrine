"use client";

import { useState } from "react";

/**
 * Panneau d'onglet animé : le contenu glisse depuis la droite quand on avance
 * dans les onglets, depuis la gauche quand on recule. Les keyframes vivent dans
 * globals.css (`.tab-panel-next` / `.tab-panel-prev`), aux côtés de `.pro-swap`
 * dont elles reprennent la courbe et le repli « mouvement réduit ».
 *
 * `index` = position de l'onglet actif dans la barre : c'est lui, et non la
 * simple bascule, qui donne le SENS du glissement.
 *
 * Réservé aux onglets qui échangent du CONTENU affiché. À ne pas poser sur des
 * champs de formulaire : le remontage exigé par l'animation les réinitialiserait
 * et ferait sauter le focus en pleine saisie.
 */
export default function TabPanel({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  // Motif React « ajuster l'état pendant le rendu » plutôt qu'un useEffect : la
  // bonne classe doit être posée DÈS le premier rendu du nouvel onglet. Un effet
  // ne s'exécuterait qu'après le paint — le panneau apparaîtrait d'abord en
  // place, puis sauterait pour s'animer.
  const [prevIndex, setPrevIndex] = useState(index);
  const [dir, setDir] = useState<"next" | "prev">("next");
  if (prevIndex !== index) {
    setDir(index > prevIndex ? "next" : "prev");
    setPrevIndex(index);
  }

  return (
    // `key` change à chaque onglet : c'est le seul moyen de faire REJOUER une
    // animation CSS (sans remontage, la classe déjà posée ne redémarre pas).
    <div
      key={index}
      className={
        className ? `tab-panel-${dir} ${className}` : `tab-panel-${dir}`
      }
    >
      {children}
    </div>
  );
}
