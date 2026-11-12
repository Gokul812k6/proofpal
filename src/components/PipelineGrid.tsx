import { useMemo, useRef, useState } from 'react';
import { AgGridReact, CustomCellRendererProps } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { Download, ListChecks, Search, Table2 } from 'lucide-react';
import CriteriaGrid from '@/components/CriteriaGrid';
import { money, Project, statuses, totalsByCurrency, User } from '@/lib/api';
import { gridModules, gridTheme } from '@/lib/grid';

interface Row { id: string; name: string; client: string; role: 'Freelancer' | 'Client'; status: Project['status']; stage: string; yourMove: boolean; value: number; currency: string; created: string; daysOpen: number }

const progress: Record<Project['status'], number> = { draft: 1, active: 2, review: 3, revision: 3, approved: 4 };
const filters = [['all', 'All'], ['move', 'Your move'], ['review', 'In review'], ['approved', 'Approved']] as const;

function isYourMove(p: Project, role: Row['role']) {
  return role === 'Freelancer' ? p.status === 'active' || p.status === 'revision' : p.status === 'draft' || p.status === 'review';
}
function ProjectCell({ data }: CustomCellRendererProps<Row>) {
  return <span className="grid-project"><strong>{data?.name}</strong><small>{data?.client}</small></span>;
}
function StageCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return <span className="grid-stage"><span className={`grid-stage-label ${data.status}`}>{data.stage}</span><span className="grid-stage-bar"><i style={{ width: `${progress[data.status] * 25}%` }} /></span></span>;
}
function MoveCell({ value }: CustomCellRendererProps<Row, boolean>) {
  return value ? <span className="grid-move">Your move</span> : <span className="grid-wait">Waiting</span>;
}

export default function PipelineGrid({ projects, user, open }: { projects: Project[]; user: User; open: (id: string) => void }) {
  const grid = useRef<AgGridReact<Row>>(null);
  const [view, setView] = useState<'projects' | 'criteria'>('projects');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number][0]>('all');
  const rows = useMemo<Row[]>(() => projects.map(p => {
    const role = p.owner_id === user.id ? 'Freelancer' : 'Client';
    return { id: p.id, name: p.name, client: p.client_name, role, status: p.status, stage: statuses[p.status], yourMove: isYourMove(p, role), value: p.amount_cents / 100, currency: p.currency, created: p.created_at, daysOpen: Math.max(0, Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000)) };
  }), [projects, user.id]);
  const visible = rows.filter(r => filter === 'all' || (filter === 'move' ? r.yourMove : filter === 'review' ? r.status === 'review' : r.status === 'approved'));
  const columns = useMemo<ColDef<Row>[]>(() => [
    { field: 'name', headerName: 'Project', cellRenderer: ProjectCell, flex: 2, minWidth: 220, getQuickFilterText: p => `${p.data?.name} ${p.data?.client}` },
    { field: 'role', headerName: 'Your role', width: 130 },
    { field: 'stage', headerName: 'Stage', cellRenderer: StageCell, flex: 1.4, minWidth: 190, comparator: (_a, _b, a, b) => progress[a.data!.status] - progress[b.data!.status] },
    { field: 'yourMove', headerName: 'Next step', cellRenderer: MoveCell, width: 130 },
    { field: 'value', headerName: 'Value', type: 'rightAligned', width: 150, valueFormatter: p => p.data ? money(Math.round(p.value * 100), p.data.currency) : '' },
    { field: 'currency', headerName: 'Currency', width: 115 },
    { field: 'daysOpen', headerName: 'Days open', type: 'rightAligned', width: 125 },
    { field: 'created', headerName: 'Created', width: 140, sort: 'desc', valueFormatter: p => new Date(p.value).toLocaleDateString(undefined, { dateStyle: 'medium' }) },
  ], []);
  const approved = projects.filter(p => p.status === 'approved');
  const inFlight = projects.filter(p => p.status !== 'approved');

  return <section className="panel pipeline">
    <div className="pipeline-views" role="tablist" aria-label="Pipeline view">
      <button role="tab" aria-selected={view === 'projects'} className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}><Table2 size={16} />Projects</button>
      <button role="tab" aria-selected={view === 'criteria'} className={view === 'criteria' ? 'active' : ''} onClick={() => setView('criteria')}><ListChecks size={16} />Criteria tracker</button>
    </div>
    {view === 'criteria' ? <CriteriaGrid projects={projects} open={open} /> : <>
    <div className="pipeline-summary">
      <div><small>In progress</small><strong>{totalsByCurrency(inFlight)}</strong><span>{inFlight.length} open agreement{inFlight.length === 1 ? '' : 's'}</span></div>
      <div><small>Approved</small><strong>{totalsByCurrency(approved)}</strong><span>{approved.length} verified handoff{approved.length === 1 ? '' : 's'}</span></div>
      <div className="highlight"><small>Waiting on you</small><strong>{rows.filter(r => r.yourMove).length}</strong><span>Projects that need your action</span></div>
    </div>
    <div className="pipeline-toolbar">
      <div className="pipeline-filters" role="group" aria-label="Filter projects">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{key === 'all' ? rows.length : rows.filter(r => key === 'move' ? r.yourMove : r.status === key).length}</span></button>)}</div>
      <label className="pipeline-search"><Search size={16} /><input type="search" placeholder="Search projects or clients" aria-label="Search projects or clients" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <button className="secondary" disabled={!visible.length} onClick={() => grid.current?.api.exportDataAsCsv({ fileName: 'proofpal-pipeline.csv', columnKeys: ['name', 'role', 'stage', 'value', 'currency', 'daysOpen', 'created'] })}><Download size={16} />Export CSV</button>
    </div>
    <div className="pipeline-grid">
      <AgGridReact<Row> ref={grid} modules={gridModules} theme={gridTheme} rowData={visible} columnDefs={columns} getRowId={p => p.data.id} quickFilterText={search} domLayout="autoHeight" rowHeight={64} pagination paginationPageSize={10} paginationPageSizeSelector={[10, 25, 50]} animateRows defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }} onRowClicked={e => e.data && open(e.data.id)} overlayNoRowsTemplate="No projects match this view." rowClass="pipeline-row" />
    </div>
    <p className="pipeline-hint">Click any row to open the project. Sort by any column, or export the current view for your records.</p>
    </>}
  </section>;
}
