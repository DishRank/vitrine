import Image from 'next/image';
import Link from 'next/link';
import styles from '../../partage.module.css';
import AppFooter from '../../AppFooter';

/** Base injoignable : jamais de 500, une page qui dit quoi faire. */
export default function OutingUnavailable({ token }: { token: string }) {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.brand}>
          <Image src="/img/icon-v2.webp" alt="" width={28} height={28} />
          DishRank
        </Link>
        <section className={styles.closedState}>
          <h2 className={styles.display}>Sortie indisponible</h2>
          <p>La sortie n’a pas pu être chargée. Vérifie ta connexion puis recharge la page.</p>
          <div className={styles.btnRow}>
            <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} href={`/s/${token}`}>
              Recharger
            </a>
          </div>
        </section>
        <AppFooter deepLinkPath={`s/${token}`} />
      </div>
    </main>
  );
}
