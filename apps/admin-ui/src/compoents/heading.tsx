import LanguageSelector from "@/compoents/LanguageSelector";
import styles from "./heading.module.css";

export const Heading = ({title}: { title: string }) => (
    <header className={styles.heading}>
        <h1>{title}</h1>
        <LanguageSelector></LanguageSelector>
    </header>
);