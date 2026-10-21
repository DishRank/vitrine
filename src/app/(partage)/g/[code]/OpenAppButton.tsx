'use client';
import styles from '../../partage.module.css';
import { useDeepLink } from '../../useDeepLink';

export default function OpenAppButton({ path }: { path: string }) {
  const href = useDeepLink(path);
  return (
    <a className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} href={href ?? `dishrank://${path}`}>
      Rejoindre dans l’app
    </a>
  );
}
