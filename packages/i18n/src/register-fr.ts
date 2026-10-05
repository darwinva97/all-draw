/** Registra el diccionario francés (y el inglés, su respaldo) de forma síncrona (Node, tests, servidor): `import '@all-draw/i18n/fr'`. */
import './register-en';
import { addTranslations } from './index';
import { fr } from './fr';

addTranslations('fr', fr);
