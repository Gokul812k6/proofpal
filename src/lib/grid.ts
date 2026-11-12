import { CellStyleModule, ClientSideRowModelModule, CsvExportModule, PaginationModule, QuickFilterModule, RowAutoHeightModule, RowStyleModule, themeQuartz } from 'ag-grid-community';

export const gridModules = [CellStyleModule, ClientSideRowModelModule, PaginationModule, QuickFilterModule, CsvExportModule, RowAutoHeightModule, RowStyleModule];
export const gridTheme = themeQuartz.withParams({ fontFamily: 'Manrope, sans-serif', accentColor: '#b52d32', foregroundColor: '#272a2f', headerBackgroundColor: '#fafaf7', headerFontWeight: 600, borderColor: '#e4e5e0', rowHoverColor: '#fbf4ef', selectedRowBackgroundColor: '#fbf4ef', wrapperBorderRadius: 10, spacing: 8, fontSize: 14 });
