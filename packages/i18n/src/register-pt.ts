/** Registra el diccionario portugués (y el inglés, su respaldo) de forma síncrona (Node, tests, servidor): `import '@all-draw/i18n/pt'`. */
import './register-en';
import { addTranslations } from './index';
import { pt } from './pt';

addTranslations('pt', pt);
