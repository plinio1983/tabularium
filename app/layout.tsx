import './globals.css';
import './mobile.css';
import ShellChrome from '@/components/ShellChrome';

export const metadata = {
  title: 'Tabularium',
  description: 'Gestionale interno per incassi, spese, fornitori e report mensili',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b2f66',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body><main className="shell">
    <ShellChrome slot="header" />

    <script dangerouslySetInnerHTML={{ __html: String.raw`
      (() => {
        const parseValue = (text) => {
          const raw = String(text || '').replace(/\s+/g, ' ').trim();
          const dateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (dateMatch) return Number(dateMatch[3] + dateMatch[2].padStart(2, '0') + dateMatch[1].padStart(2, '0'));
          const monthYearMatch = raw.match(/^(\d{1,2})\/(\d{4})$/);
          if (monthYearMatch) return Number(monthYearMatch[2] + monthYearMatch[1].padStart(2, '0'));
          const money = raw.replace(/€/g, '').replace(/\./g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
          if (money && /[€\d]/.test(raw) && raw.replace(/[^0-9]/g, '').length) return Number(money[0]);
          return raw.toLocaleLowerCase('it-IT');
        };
        const compare = (a, b) => {
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a).localeCompare(String(b), 'it', { numeric: true, sensitivity: 'base' });
        };
        const initTable = (table) => {
          if (table.dataset.sortReady === '1') return;
          table.dataset.sortReady = '1';
          const headers = table.querySelectorAll('thead th');
          headers.forEach((th, index) => {
            const label = th.textContent.trim();
            if (!label || th.querySelector('.sr-only') || th.dataset.noSort === 'true') return;
            th.classList.add('sortable-th');
            th.tabIndex = 0;
            th.setAttribute('role', 'button');
            th.setAttribute('title', 'Ordina per ' + label.replace(/\s+/g, ' '));
            const sort = () => {
              const tbody = table.tBodies[0];
              if (!tbody) return;
              const direction = th.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
              headers.forEach(h => { h.removeAttribute('data-sort-direction'); h.classList.remove('sort-asc', 'sort-desc'); });
              th.dataset.sortDirection = direction;
              th.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
              const rows = Array.from(tbody.rows).filter(row => row.cells.length > 1);
              rows.sort((rowA, rowB) => {
                const a = parseValue(rowA.cells[index]?.innerText || '');
                const b = parseValue(rowB.cells[index]?.innerText || '');
                const result = compare(a, b);
                return direction === 'asc' ? result : -result;
              });
              rows.forEach(row => tbody.appendChild(row));
            };
            th.addEventListener('click', sort);
            th.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                sort();
              }
            });
          });
        };
        const initAllTables = () => document.querySelectorAll('table').forEach(initTable);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAllTables);
        else initAllTables();
        new MutationObserver(initAllTables).observe(document.body, { childList: true, subtree: true });
      })();
    ` }} />
    <script dangerouslySetInnerHTML={{ __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    ` }} />
    {children}{/* dms-root-suspense-boundary */}
    <ShellChrome slot="footer" />
  </main></body></html>;
}
