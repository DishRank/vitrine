import Image from 'next/image';
import Link from 'next/link';
import styles from '../../partage.module.css';
import AppFooter from '../../AppFooter';

export default function OutingNotFound() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/" className={styles.brand}>
          <Image src="/img/icon-v2.webp" alt="" width={28} height={28} />
          DishRank
        </Link>
        <section className={styles.closedState}>
          <h2 className={styles.display}>Lien introuvable</h2>
          <p>
            Cette sortie n’existe pas ou a été supprimée. Demande à la personne qui t’a envoyé le lien de
            t’en partager un nouveau.
          </p>
        </section>
        <AppFooter />
      </div>
    </main>
  );
}
