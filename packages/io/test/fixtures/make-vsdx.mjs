// Genera `flujo-bpmn.vsdx` (fixture de los tests de Visio) con la estructura de un .vsdx de Visio 2013+:
// maestros de «Diagrama de flujo básico» y «BPMN básico», un grupo, datos de forma, conectores pegados (uno con quiebros
// y otro discontinuo), una imagen incrustada y una página de fondo.   node packages/io/test/fixtures/make-vsdx.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { zipSync, strToU8 } = createRequire(join(here, '../../package.json'))('fflate');
const NS = `xmlns='http://schemas.microsoft.com/office/visio/2012/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xml:space='preserve'`;
const head = "<?xml version='1.0' encoding='utf-8' ?>\n";
const cell = (n, v, extra = '') => `<Cell N='${n}' V='${v}'${extra}/>`;
const rect = (w, h) => `<Section N='Geometry' IX='0'><Row T='MoveTo' IX='1'>${cell('X', 0)}${cell('Y', 0)}</Row><Row T='LineTo' IX='2'>${cell('X', w)}${cell('Y', 0)}</Row><Row T='LineTo' IX='3'>${cell('X', w)}${cell('Y', h)}</Row><Row T='LineTo' IX='4'>${cell('X', 0)}${cell('Y', h)}</Row><Row T='LineTo' IX='5'>${cell('X', 0)}${cell('Y', 0)}</Row></Section>`;
const ellipse = (w, h) => `<Section N='Geometry' IX='0'><Row T='Ellipse' IX='1'>${cell('X', w / 2)}${cell('Y', h / 2)}${cell('A', w)}${cell('B', h / 2)}${cell('C', w / 2)}${cell('D', h)}</Row></Section>`;

const MASTERS = [
  { id: 1, name: 'Start/End', w: 1, h: 0.5 }, { id: 2, name: 'Process', w: 1, h: 0.75 }, { id: 3, name: 'Decision', w: 1, h: 0.75 },
  { id: 4, name: 'Document', w: 1, h: 0.75 }, { id: 5, name: 'Dynamic connector', connector: true }, { id: 6, name: 'Task', w: 1.2, h: 0.8 },
  { id: 7, name: 'Start Event', w: 0.4, h: 0.4, round: true }, { id: 8, name: 'End Event', w: 0.4, h: 0.4, round: true }, { id: 9, name: 'Gateway', w: 0.6, h: 0.6 },
  { id: 10, name: 'Sequence Flow', connector: true }, { id: 11, name: 'Association', connector: true }, { id: 12, name: 'Data Store', w: 0.7, h: 0.7 },
];
const masterXml = m => m.connector
  ? `${head}<MasterContents ${NS}><Shapes><Shape ID='5' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${cell('PinX', 0.5)}${cell('PinY', 0.5)}${cell('Width', 1)}${cell('Height', 0)}${cell('BeginX', 0)}${cell('BeginY', 0)}${cell('EndX', 1)}${cell('EndY', 1)}${cell('EndArrow', m.name === 'Association' ? 0 : 13)}${cell('LinePattern', m.name === 'Association' ? 3 : 1)}<Section N='Geometry' IX='0'><Row T='MoveTo' IX='1'>${cell('X', 0)}${cell('Y', 0)}</Row><Row T='LineTo' IX='2'>${cell('X', 0)}${cell('Y', -1.18)}</Row><Row T='LineTo' IX='3'>${cell('X', 1.18)}${cell('Y', -1.18)}</Row></Section></Shape></Shapes></MasterContents>`
  : `${head}<MasterContents ${NS}><Shapes><Shape ID='5' Type='Shape' LineStyle='3' FillStyle='3' TextStyle='3'>${cell('PinX', m.w / 2)}${cell('PinY', m.h / 2)}${cell('Width', m.w)}${cell('Height', m.h)}${cell('LocPinX', m.w / 2, " F='Width*0.5'")}${cell('LocPinY', m.h / 2, " F='Height*0.5'")}${cell('FillForegnd', '#ffffff')}${m.round ? ellipse(m.w, m.h) : rect(m.w, m.h)}</Shape></Shapes></MasterContents>`;

/** Forma 2-D: `m` maestro (opcional), `p` pin, `s` tamaño (si falta, se hereda del maestro). */
const shape = ({ id, m, x, y, w, h, text, fill, data, children, type = 'Shape' }) => {
  const c = [cell('PinX', x), cell('PinY', y)];
  if (w !== undefined) c.push(cell('Width', w), cell('Height', h), cell('LocPinX', w / 2, " F='Width*0.5'"), cell('LocPinY', h / 2, " F='Height*0.5'"));
  if (fill) c.push(cell('FillForegnd', fill));
  const props = data ? `<Section N='Property'>${Object.entries(data).map(([k, v], i) => `<Row N='Prop${i}'>${cell('Label', k)}${cell('Value', v, " U='STR'")}</Row>`).join('')}</Section>` : '';
  const geo = !m && w !== undefined && type === 'Shape' ? rect(w, h) : '';
  const kids = children ? `<Shapes>${children.join('')}</Shapes>` : '';
  return `<Shape ID='${id}' Type='${type}'${m ? ` Master='${m}'` : ''} LineStyle='3' FillStyle='3' TextStyle='3'>${c.join('')}${props}${geo}${text !== undefined ? `<Text><cp IX='0'/>${text}\n</Text>` : ''}${kids}</Shape>`;
};
/** Conector 1-D (Dynamic connector): `pts` en pulgadas de página (inicio, quiebros, fin). */
const connector = ({ id, m = 5, pts, text, dashed }) => {
  const [b, e] = [pts[0], pts[pts.length - 1]];
  const minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1])), maxX = Math.max(...pts.map(p => p[0])), maxY = Math.max(...pts.map(p => p[1]));
  const w = maxX - minX, h = maxY - minY;
  const rows = pts.map((p, i) => `<Row T='${i ? 'LineTo' : 'MoveTo'}' IX='${i + 1}'>${cell('X', +(p[0] - minX).toFixed(4))}${cell('Y', +(p[1] - minY).toFixed(4))}</Row>`).join('');
  return `<Shape ID='${id}' NameU='Dynamic connector' Type='Shape' Master='${m}'>${cell('PinX', minX + w / 2)}${cell('PinY', minY + h / 2)}${cell('Width', w)}${cell('Height', h)}${cell('LocPinX', w / 2)}${cell('LocPinY', h / 2)}${cell('BeginX', b[0])}${cell('BeginY', b[1])}${cell('EndX', e[0])}${cell('EndY', e[1])}${dashed ? cell('LinePattern', 2) : ''}${pts.length > 2 ? `<Section N='Geometry' IX='0'>${rows}</Section>` : ''}${text ? `<Text>${text}</Text>` : ''}</Shape>`;
};
const connects = list => `<Connects>${list.map(([c, from, to]) => `<Connect FromSheet='${c}' FromCell='BeginX' FromPart='9' ToSheet='${from}' ToCell='PinX' ToPart='3'/><Connect FromSheet='${c}' FromCell='EndX' FromPart='12' ToSheet='${to}' ToCell='PinX' ToPart='3'/>`).join('')}</Connects>`;
const page = (shapes, links) => `${head}<PageContents ${NS}><Shapes>${shapes.join('')}</Shapes>${connects(links)}</PageContents>`;

const page1 = page([
  shape({ id: 1, m: 1, x: 1.5, y: 7.5, text: 'Inicio' }),
  shape({ id: 2, m: 2, x: 3.5, y: 7.5, w: 1.5, h: 0.75, text: 'Validar solicitud', fill: '#dae8fc', data: { Responsable: 'Ana', Coste: '12' } }),
  shape({ id: 3, m: 3, x: 3.5, y: 6, text: '¿Correcta?' }),
  shape({ id: 4, m: 2, x: 6, y: 6, text: 'Corregir' }),
  shape({ id: 5, m: 1, x: 3.5, y: 4.5, text: 'Fin' }),
  shape({ id: 6, m: 4, x: 6, y: 7.5, text: 'Informe' }),
  shape({ id: 7, type: 'Group', x: 2, y: 2.5, w: 3, h: 1.2, text: 'Equipo', children: [
    shape({ id: 8, m: 2, x: 0.7, y: 0.6, text: 'Revisor A' }),
    shape({ id: 9, x: 2.3, y: 0.6, w: 1, h: 0.6, text: 'Revisor B &amp; C' }),
  ] }),
  `<Shape ID='10' Type='Foreign'>${cell('PinX', 6)}${cell('PinY', 2.5)}${cell('Width', 1)}${cell('Height', 1)}</Shape>`,
  shape({ id: 11, x: 6, y: 3.6, w: 1.4, h: 0.3, text: 'Nota suelta' }).replace(/<Section N='Geometry'[\s\S]*?<\/Section>/, ''),
  connector({ id: 20, pts: [[2, 7.5], [2.75, 7.5]] }),
  connector({ id: 21, pts: [[3.5, 7.125], [3.5, 6.375]] }),
  connector({ id: 22, pts: [[3.5, 5.625], [3.5, 4.75]], text: 'sí' }),
  connector({ id: 23, pts: [[4, 6], [5.5, 6]], text: 'no' }),
  connector({ id: 24, pts: [[6, 6.375], [6, 6.9], [4.25, 6.9], [4.25, 7.125]] }),
  connector({ id: 25, pts: [[4.25, 7.5], [5.5, 7.5]], dashed: true }),
], [[20, 1, 2], [21, 2, 3], [22, 3, 5], [23, 3, 4], [24, 4, 2], [25, 2, 6]]);

const page2 = page([
  shape({ id: 1, m: 7, x: 1, y: 5, text: 'Pedido' }),
  shape({ id: 2, m: 6, x: 2.5, y: 5, text: 'Revisar pedido' }),
  shape({ id: 3, m: 9, x: 4.2, y: 5, text: '¿Stock?' }),
  shape({ id: 4, m: 8, x: 5.8, y: 5, text: 'Fin' }),
  shape({ id: 5, m: 12, x: 2.5, y: 3.5, text: 'Inventario' }),
  connector({ id: 10, m: 10, pts: [[1.2, 5], [1.9, 5]] }),
  connector({ id: 11, m: 10, pts: [[3.1, 5], [3.9, 5]] }),
  connector({ id: 12, m: 10, pts: [[4.5, 5], [5.6, 5]], text: 'sí' }),
  connector({ id: 13, m: 11, pts: [[2.5, 4.6], [2.5, 3.85]] }),
], [[10, 1, 2], [11, 2, 3], [12, 3, 4], [13, 2, 5]]);

const page3 = page([shape({ id: 1, x: 4, y: 0.5, w: 7, h: 0.4, text: 'Confidencial' })], []);

const pageSheet = (h, layers = 1) => `<PageSheet LineStyle='0' FillStyle='0' TextStyle='0'>${cell('PageWidth', 8.5)}${cell('PageHeight', h)}<Section N='Layer'>${Array.from({ length: layers }, (_, i) => `<Row IX='${i}'>${cell('Name', `Capa ${i}`)}</Row>`).join('')}</Section></PageSheet>`;
const files = {
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>${[1, 2, 3].map(i => `<Override PartName="/visio/pages/page${i}.xml" ContentType="application/vnd.ms-visio.page+xml"/>`).join('')}<Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/>${MASTERS.map(m => `<Override PartName="/visio/masters/master${m.id}.xml" ContentType="application/vnd.ms-visio.master+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Pedidos (Visio)</dc:title><dc:creator>all-draw tests</dc:creator></cp:coreProperties>`,
  'visio/document.xml': `${head}<VisioDocument ${NS}><DocumentSettings/></VisioDocument>`,
  'visio/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/><Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/></Relationships>`,
  'visio/pages/pages.xml': `${head}<Pages ${NS}><Page ID='0' NameU='Flujo' Name='Flujo'>${pageSheet(8.5, 2)}<Rel r:id='rId1'/></Page><Page ID='4' NameU='BPMN' Name='BPMN'>${pageSheet(8.5)}<Rel r:id='rId2'/></Page><Page ID='8' NameU='Fondo' Name='Fondo' Background='1'>${pageSheet(8.5)}<Rel r:id='rId3'/></Page></Pages>`,
  'visio/pages/_rels/pages.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId3" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page3.xml"/><Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page2.xml"/><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/></Relationships>`,
  'visio/pages/page1.xml': page1, 'visio/pages/page2.xml': page2, 'visio/pages/page3.xml': page3,
  'visio/masters/masters.xml': `${head}<Masters ${NS}>${MASTERS.map(m => `<Master ID='${m.id}' NameU='${m.name}' Name='${m.name}'><PageSheet/><Rel r:id='rId${m.id}'/></Master>`).join('')}</Masters>`,
  'visio/masters/_rels/masters.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${MASTERS.map(m => `<Relationship Id="rId${m.id}" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master${m.id}.xml"/>`).join('')}</Relationships>`,
  ...Object.fromEntries(MASTERS.map(m => [`visio/masters/master${m.id}.xml`, masterXml(m)])),
};
const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
writeFileSync(join(here, 'flujo-bpmn.vsdx'), zip);
console.log(`flujo-bpmn.vsdx: ${zip.length} bytes`);
