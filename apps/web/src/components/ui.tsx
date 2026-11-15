import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { useMemo, useState, useRef, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { type Entity } from "../lib/api";
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={contentRef}
          onOpenAutoFocus={(event) => {
            const input = contentRef.current?.querySelector<HTMLElement>(
              "input:not([disabled]),select:not([disabled]),textarea:not([disabled])",
            );
            if (input) {
              event.preventDefault();
              input.focus();
            }
          }}
          className={`dialog-content ${wide ? "wide" : ""}`}
        >
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Review the details below before saving."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-btn" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export const Badge = ({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) => {
  const value = String(children || "");
  return (
    <span
      className={`badge ${tone || (/paid|active|completed|received|verified|healthy|success|open/.test(value) && !/unpaid|inactive/.test(value) ? "green" : /expired|returned|cancelled|unpaid|out of stock|rejected|inactive/.test(value) ? "red" : /pending|partial|ordered|low stock|quarantined|expiring/.test(value) ? "amber" : "neutral")}`}
    >
      {value.replaceAll("-", " ")}
    </span>
  );
};
export const Empty = ({
  title = "Nothing here yet",
  description = "Your records will appear here as you add them.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="empty">
    <span className="empty-icon">
      <Inbox size={25} />
    </span>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>
);
export const Busy = ({ label = "Saving…" }: { label?: string }) => (
  <span className="inline-flex">
    <LoaderCircle size={16} className="spin" />
    {label}
  </span>
);
export function exportCsv(rows: Entity[], name: string) {
  if (!rows.length) return;
  const keys = [...new Set(rows.flatMap(Object.keys))].filter(
    (k) => !["password", "passwordHash", "items", "permissions"].includes(k),
  );
  const escape = (v: unknown) => {
    let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [
          keys.map(escape).join(","),
          ...rows.map((row) => keys.map((k) => escape(row[k])).join(",")),
        ].join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pharmaflow-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DataTable({
  rows,
  columns,
  placeholder = "Search records…",
  name = "records",
  extra,
  initialSearch = "",
  onRowClick,
}: {
  rows: Entity[];
  columns: ColumnDef<Entity, any>[];
  placeholder?: string;
  name?: string;
  extra?: ReactNode;
  initialSearch?: string;
  onRowClick?: (row: Entity) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const data = useMemo(() => rows, [rows]);
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  return (
    <div className="table-card">
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={placeholder}
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-btn small"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          {extra}
          <button
            className="btn subtle"
            onClick={() =>
              exportCsv(
                table.getFilteredRowModel().rows.map((r) => r.original),
                name,
              )
            }
            disabled={!rows.length}
          >
            <Download size={15} />
            Export
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <ArrowUpDown size={12} />
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={onRowClick ? "clickable" : ""}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!table.getFilteredRowModel().rows.length && (
        <Empty
          title={search ? "No matching records" : "No records yet"}
          description={
            search
              ? "Try another name, reference, or search term."
              : "Create your first record to get started."
          }
        />
      )}
      <div className="table-footer">
        <span>
          {table.getFilteredRowModel().rows.length
            ? `${table.getState().pagination.pageIndex * 10 + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * 10, table.getFilteredRowModel().rows.length)}`
            : "0"}{" "}
          of {table.getFilteredRowModel().rows.length} records
        </span>
        <div className="pagination">
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
