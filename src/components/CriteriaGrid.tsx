import { useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact, CustomCellRendererProps } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Download, Search } from 'lucide-react';
import { api, Criterion, Detail, Project, statuses } from '@/lib/api';
import { gridModules, gridTheme } from '@/lib/grid';

interface Row { id: string; title: string; status: Criterion['status']; projectId: string; project: string; client: string; stage: string; files: number }

const labels: Record<Criterion['status'], string> = { met: 'Met', uncertain: 'Needs a look', missing: 'Missing' };
const order: Record<Criterion['status'], number> = { missing: 0, uncertain: 1, met: 2 };
const filters = [['all', 'All'], ['missing', 'Missing'], ['uncertain', 'Needs a look'], ['met', 'Met']] as const;

function StatusCell({ data }: CustomCellRendererProps<Row>) {
  return data ? <span className={`grid-criterion ${data.status}`}><i />{labels[data.status]}</span> : null;
}
function ProjectCell({ data }: CustomCellRendererProps<Row>) {
  return <span className="grid-project"><strong>{data?.project}</strong><small>{data?.client} · {data?.stage}</small></span>;
}

export default function CriteriaGrid({ projects, open }: { projects: Project[]; open: (id: string) => void }) {
  const grid = useRef<AgGridReact<Row>>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  useEffect(() => {
    let cancelled = false;
    setRows(null); setError('');
    Promise.all(projects.map(p => api<Detail>(`/projects/${p.id}`))).then(details => {
      if (details.some(d => !d?.project?.id || !Array.isArray(d.criteria) || !Array.isArray(d.deliveries))) throw new Error('Unable to read your criteria. Please refresh.');
      const next = details.flatMap(d => d.criteria.map(c => ({ id: c.id, title: c.title, status: c.status in labels ? c.status : 'uncertain', projectId: d.project.id, project: d.project.name, client: d.project.client_name, stage: statuses[d.project.status], files: d.deliveries.length } as Row)));
      if (!cancelled) setRows(next);
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load criteria.'); });
    return () => { cancelled = true; };
  }, [projects]);
  const columns = useMemo<ColDef<Row>[]>(() => [
    { field: 'title', headerName: 'Success criterion', flex: 2.2, minWidth: 240, wrapText: true, autoHeight: true, cellClass: 'grid-criterion-title' },
    { field: 'status', headerName: 'Status', cellRenderer: StatusCell, width: 160, sort: 'asc', comparator: (a: Row['status'], b: Row['status']) => order[a] - order[b] },
    { field: 'project', headerName: 'Project', cellRenderer: ProjectCell, flex: 1.6, minWidth: 220, getQuickFilterText: p => `${p.data?.project} ${p.data?.client}` },
    { field: 'files', headerName: 'Files delivered', type: 'rightAligned', width: 150 },
  ], []);

  if (error) return <div className="empty-state"><h2>Criteria could not be loaded.</h2><p>{error}</p></div>;
  if (!rows) return <p className="loading-note" role="status">Gathering criteria from {projects.length} project{projects.length === 1 ? '' : 's'}…</p>;
  const count = (s: Criterion['status']) => rows.filter(r => r.status === s).length;
  const done = rows.length ? Math.round(count('met') / rows.length * 100) : 0;
  const visible = rows.filter(r => filter === 'all' || r.status === filter);

  return <>
    <div className="pipeline-summary">
      <div><small>Overall completion</small><strong>{done}%</strong><span className="criteria-meter"><i style={{ width: `${done}%` }} /></span></div>
      <div><small>Met</small><strong>{count('met')}<em> of {rows.length}</em></strong><span>Confirmed in a human review</span></div>
      <div className="highlight"><small>Still open</small><strong>{count('missing') + count('uncertain')}</strong><span>{count('missing')} missing · {count('uncertain')} need a look</span></div>
    </div>
    <div className="pipeline-toolbar">
      <div className="pipeline-filters" role="group" aria-label="Filter criteria">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === 'all' ? rows.length : count(key)}</span></button>)}</div>
      <label className="pipeline-search"><Search size={16} /><input type="search" placeholder="Search criteria or projects" aria-label="Search criteria or projects" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="secondary" disabled={!visible.length} onClick={() => grid.current?.api.exportDataAsCsv({ fileName: 'proofpal-criteria.csv', columnKeys: ['title', 'status', 'project', 'files'], processCellCallback: p => p.column.getColId() === 'status' ? labels[p.value as Row['status']] : p.value })}><Download size={16} />Export CSV</button>
    </div>
    <div className="pipeline-grid">
      <AgGridReact<Row> ref={grid} modules={gridModules} theme={gridTheme} rowData={visible} columnDefs={columns} getRowId={p => p.data.id} quickFilterText={search} domLayout="autoHeight" rowHeight={64} pagination paginationPageSize={10} paginationPageSizeSelector={[10, 25, 50]} animateRows defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }} onRowClicked={e => e.data && open(e.data.projectId)} overlayNoRowsTemplate="No criteria match this view." rowClass="pipeline-row" />
    </div>
    <p className="pipeline-hint">Every success criterion across your projects, open items first. Click a row to jump to its project.</p>
  </>;
}
