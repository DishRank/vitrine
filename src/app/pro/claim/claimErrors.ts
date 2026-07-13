/** Codes d'erreur de l'edge fn claim-verify → messages FR (miroir de mapErr
 *  côté app). Module plain (pas 'use server') : réutilisé par le client. */
export function mapClaimError(code?: string, domain?: string): string {
  switch (code) {
    case 'no_verifiable_contact':
      return 'Aucun email de contact vérifiable pour cet établissement. Utilisez la demande manuelle ci-dessous.';
    case 'domain_mismatch':
      return `L'email doit être sur le domaine ${domain ?? 'de l’établissement'}.`;
    case 'email_required':
      return 'Entrez un email professionnel sur le domaine de l’établissement.';
    case 'bad_code':
      return 'Code incorrect. Vérifiez et réessayez.';
    case 'code_expired':
      return 'Le code a expiré. Demandez-en un nouveau.';
    case 'too_many_attempts':
      return 'Trop de tentatives. Demandez un nouveau code.';
    case 'cooldown':
      return 'Patientez une minute avant de redemander un code.';
    case 'send_failed':
    case 'smtp_not_configured':
      return "L'envoi de l'email a échoué. Réessayez ou utilisez la demande manuelle.";
    case 'already_owned':
      return 'Cet établissement est déjà revendiqué.';
    case 'restaurant_not_found':
      return 'Établissement introuvable.';
    default:
      return 'Une erreur est survenue. Réessayez.';
  }
}
