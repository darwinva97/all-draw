/** Registra el diccionario inglés de forma síncrona (Node, tests, servidor): `import '@all-draw/i18n/en'`. */
import { addTranslations } from './index';
import { en } from './en';

addTranslations('en', en);
