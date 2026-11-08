import { redirect } from 'next/navigation';

/**
 * /pro/r sans établissement (adresse raccourcie à la main, lien tronqué) :
 * direction le tableau de bord, qui ouvre l'établissement ou propose d'en
 * revendiquer un. Sans cette page, Next affichait sa 404 brute en anglais.
 */
export default function ProWorkspaceIndex() {
  redirect('/pro/espace');
}