'use client';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';
import styles from './partage.module.css';
import { useDeepLink } from './useDeepLink';

/**
 * Pied des pages de partage : ouvrir le même écran dans l'app si elle est
 * installée, sinon les liens des stores.
 */
export default function AppFooter({ deepLinkPath }: { deepLinkPath?: string }) {
  const href = useDeepLink(deepLinkPath);

  return (
    <footer className={styles.app}>
      {href && (
        <>
          <p>Tu as déjà l’app DishRank ?</p>
          <a className={`${styles.btn} ${styles.btnGhost}`} href={href}>
            Ouvrir dans l’app
          </a>
        </>
      )}
      <p>
        {href ? 'Pas encore ? ' : ''}DishRank note les plats, pas les restos.
      </p>
      <div className={styles.stores}>
        <a className={styles.link} href={APP_STORE_URL}>
          Télécharger sur l’App Store
        </a>
        <a className={styles.link} href={PLAY_STORE_URL}>
          Télécharger sur Google Play
        </a>
      </div>
    </footer>
  );
}
