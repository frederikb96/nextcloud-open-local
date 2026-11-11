/**
 * The pictures are composed from invented content: a stand-in for a Nextcloud Files page, a browser
 * frame with the extension's toolbar button, and the desktop application the file opens in. All
 * names are made up and every date is relative, so the images never look stale.
 */

const FONT = `font-family: 'Noto Sans', 'DejaVu Sans', 'Liberation Sans', sans-serif;`;

export const SERVER = 'cloud.example.org';
export const FOLDER = 'Documents / Reports';
export const SELECTED = 'Quarterly Report.docx';

interface Row {
  name: string;
  size: string;
  modified: string;
  folder?: boolean;
  selected?: boolean;
}

const ROWS: Row[] = [
  { name: 'Archive', size: '48 MB', modified: '3 weeks ago', folder: true },
  { name: 'Budget 2027.xlsx', size: '86 KB', modified: '1 day ago' },
  { name: 'Meeting Notes.md', size: '4 KB', modified: '3 hours ago' },
  { name: SELECTED, size: '212 KB', modified: '2 hours ago', selected: true },
  { name: 'Roadmap Draft.odt', size: '39 KB', modified: '5 days ago' },
  { name: 'Site Photos', size: '312 MB', modified: '2 weeks ago', folder: true },
  { name: 'Supplier Contract.pdf', size: '1.2 MB', modified: '2 months ago' },
];

const FOLDER_ICON =
  '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h6l2 2.5h9A1.5 1.5 0 0 1 22 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#3b82c4"/></svg>';
const FILE_ICON =
  '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="#dfe6ee" stroke="#9aa9ba"/><path d="M14 2v5h5" fill="#c3cfdc"/></svg>';

function row(r: Row): string {
  return `<tr class="${r.selected ? 'sel' : ''}">
    <td class="chk"><span class="box ${r.selected ? 'on' : ''}"></span></td>
    <td class="name">${r.folder ? FOLDER_ICON : FILE_ICON}<span>${r.name}</span></td>
    <td class="num">${r.size}</td><td class="num">${r.modified}</td></tr>`;
}

/** A Files-style page: sidebar, breadcrumb, file table with one selected row. */
export function filesPage(width: number, height: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { margin: 0; width: ${width}px; height: ${height}px; background: #fff; color: #222; ${FONT} font-size: 14px; display: flex; overflow: hidden; }
    nav { width: 210px; background: #f4f6f9; padding: 18px 12px; border-right: 1px solid #e3e8ee; }
    nav .brand { height: 34px; margin: 0 8px 18px; display: flex; align-items: center; gap: 8px; font-weight: 700; color: #0b5fa5; }
    nav .brand i { width: 22px; height: 22px; border-radius: 50%; border: 4px solid #0b5fa5; display: inline-block; }
    nav a { display: block; padding: 9px 12px; border-radius: 8px; color: #444; margin-bottom: 2px; }
    nav a.on { background: #dbe8f5; color: #0b4a82; font-weight: 600; }
    main { flex: 1; padding: 20px 28px; }
    .top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .crumb { font-size: 20px; font-weight: 600; } .crumb small { color: #8a96a3; font-weight: 400; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; color: #6b7785; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #e3e8ee; }
    td { padding: 0 10px; height: 52px; border-bottom: 1px solid #eef1f5; }
    td.name { display: flex; align-items: center; gap: 12px; height: 52px; } td.num { color: #6b7785; width: 140px; } td.chk { width: 36px; }
    .box { display: inline-block; width: 18px; height: 18px; border: 2px solid #b9c3cf; border-radius: 50%; vertical-align: middle; }
    .box.on { background: #0b5fa5; border-color: #0b5fa5; box-shadow: inset 0 0 0 3px #fff; }
    tr.sel { background: #e8f1fb; }
  </style></head><body>
  <nav><div class="brand"><i></i>Files</div><a class="on">All files</a><a>Recent</a><a>Favorites</a><a>Shares</a><a>Tags</a></nav>
  <main><div class="top"><div class="crumb"><small>Files /</small> ${FOLDER}</div></div>
  <table><tr><th></th><th>Name</th><th>Size</th><th>Modified</th></tr>${ROWS.map(row).join('')}</table></main></body></html>`;
}

/** What a browser frame, the toolbar button and the opened application add around the page. */
export function hero(pageImage: string, iconImage: string): string {
  const WIDTH = 1440;
  const HEIGHT = 860;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; background: #eaf1f8; position: relative; overflow: hidden; ${FONT} }
    .win { position: absolute; background: #fff; border-radius: 12px; box-shadow: 0 18px 50px rgba(11,26,74,.22), 0 0 0 1px #c9d4e0; overflow: hidden; }
    .browser { left: 50px; top: 40px; width: 1010px; height: 700px; }
    .tabs { height: 38px; background: #dbe3ec; display: flex; align-items: flex-end; padding: 0 12px; gap: 6px; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: #aab6c4; align-self: center; margin-right: 4px; }
    .tab { background: #f4f7fa; height: 30px; padding: 0 16px; border-radius: 8px 8px 0 0; font-size: 12px; display: flex; align-items: center; color: #333; }
    .bar { height: 46px; background: #f4f7fa; display: flex; align-items: center; padding: 0 14px; gap: 12px; border-bottom: 1px solid #dbe3ec; }
    .url { flex: 1; height: 30px; border-radius: 15px; background: #e6ecf3; padding: 0 16px; display: flex; align-items: center; font-size: 13px; color: #44505e; }
    .ext { position: relative; width: 34px; height: 34px; border-radius: 8px; background: #d3e3f5; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #f28c28; }
    .ext img { width: 24px; height: 24px; }
    .tip { position: absolute; top: 40px; right: -4px; background: #222; color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 6px; white-space: nowrap; z-index: 2; }
    .page { width: 1010px; height: 616px; } .page img { display: block; width: 1010px; }
    .app { left: 840px; top: 400px; width: 560px; height: 430px; }
    .atitle { height: 38px; background: #2f3a4b; color: #fff; display: flex; align-items: center; padding: 0 16px; font-size: 13px; }
    .abody { background: #e9edf2; height: 392px; padding: 26px 70px; }
    .doc { background: #fff; height: 100%; border-radius: 3px; box-shadow: 0 1px 6px rgba(0,0,0,.18); padding: 28px 30px; }
    .doc b { display: block; height: 16px; width: 55%; background: #26364d; border-radius: 3px; margin-bottom: 22px; }
    .doc i { display: block; height: 8px; background: #c8d1dc; border-radius: 3px; margin-bottom: 14px; }
    svg.flow { position: absolute; left: 0; top: 0; pointer-events: none; }
  </style></head><body>
  <div class="win browser">
    <div class="tabs"><span class="dot"></span><span class="dot"></span><span class="dot"></span><div class="tab">Files - ${FOLDER}</div></div>
    <div class="bar"><div class="url">${SERVER}/apps/files/files/4711?dir=/Documents/Reports</div>
      <div class="ext"><img src="${iconImage}"><div class="tip">Open this file locally (Alt+Shift+O)</div></div></div>
    <div class="page"><img src="${pageImage}"></div>
  </div>
  <div class="win app"><div class="atitle">${SELECTED}</div><div class="abody"><div class="doc"><b></b>
    <i style="width:100%"></i><i style="width:96%"></i><i style="width:100%"></i><i style="width:88%"></i><i style="width:100%"></i><i style="width:64%"></i></div></div></div>
  <svg class="flow" width="${WIDTH}" height="${HEIGHT}"><defs><marker id="h" markerWidth="22" markerHeight="22" refX="14" refY="11" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L22,11 L0,22 z" fill="#f28c28"/></marker></defs>
    <path d="M1044 126 C 1230 130 1290 250 1200 385" fill="none" stroke="#f28c28" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round" marker-end="url(#h)"/></svg>
  </body></html>`;
}

/** The notification the extension raises when it has nothing to open. */
export function notification(message: string, iconImage: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; } body { margin: 0; width: 760px; height: 190px; background: #eaf1f8; display: flex; align-items: center; justify-content: center; ${FONT} }
    .n { width: 640px; background: #2b2f36; color: #f2f4f7; border-radius: 14px; padding: 18px 22px; display: flex; gap: 16px; box-shadow: 0 10px 30px rgba(11,26,74,.3); }
    .n img { width: 44px; height: 44px; } .t { font-weight: 700; font-size: 15px; margin-bottom: 6px; } .m { font-size: 14px; line-height: 1.45; color: #d6dbe3; }
  </style></head><body><div class="n"><img src="${iconImage}"><div><div class="t">Nextcloud Open Locally</div><div class="m">${message}</div></div></div></body></html>`;
}
