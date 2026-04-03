'use client';

import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { BackgroundImageTexture } from '@/components/ui/bg-image-texture';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { statusBorderColor } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { type CellRendererType, renderCell } from './cell-renderers';
import { type InferredColumn, inferColumns } from './column-inference';

interface DataTableProps<T extends Record<string, unknown>> {
    data: T[];
    columns?: InferredColumn[];
    pageSize?: number;
    totalItems?: number;
    pageIndex?: number;
    onPageChange?: (page: number) => void;
    isLoading?: boolean;
    title?: string;
    /** Key in the row data to use for a colored left border (e.g. "status") */
    statusKey?: string;
}

export function DataTable<T extends Record<string, unknown>>({
    data,
    columns: columnsProp,
    pageSize = 25,
    totalItems,
    pageIndex = 0,
    onPageChange,
    isLoading,
    title,
    statusKey,
}: DataTableProps<T>) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const inferredColumns = columnsProp ?? (data.length > 0 ? inferColumns(data[0]) : []);

    const tableColumns: ColumnDef<T>[] = inferredColumns.map((col) => ({
        accessorKey: col.key,
        header: ({ column }) => {
            if (!col.sortable) return col.label;
            const sorted = column.getIsSorted();
            return (
                <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => column.toggleSorting(sorted === 'asc')}
                >
                    {col.label}
                    {sorted === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5" />
                    ) : sorted === 'desc' ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                </button>
            );
        },
        cell: ({ getValue, row }) => {
            const value = getValue();
            const rowData = row.original as Record<string, unknown>;
            const tokenMeta = rowData.tokenMetadata as { decimals?: number; ticker?: string } | undefined;
            return renderCell(col.render as CellRendererType, value, {
                decimals: tokenMeta?.decimals,
                ticker: tokenMeta?.ticker,
            });
        },
        enableSorting: col.sortable,
    }));

    const table = useReactTable({
        data,
        columns: tableColumns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: !!onPageChange,
    });

    const totalPages = totalItems ? Math.ceil(totalItems / pageSize) : undefined;

    if (isLoading) {
        return <DataTableSkeleton rows={5} cols={inferredColumns.length || 4} title={title} />;
    }

    return (
        <div>
            {title && <h3 className="mb-2 text-sm font-medium">{title}</h3>}
            <BackgroundImageTexture
                variant="fabric-of-squares"
                opacity={0.03}
                className="overflow-x-auto rounded-md border"
            >
                <Table className="w-full min-w-[600px]">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} className="whitespace-nowrap">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={tableColumns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No data
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => {
                                const statusVal = statusKey
                                    ? String((row.original as Record<string, unknown>)[statusKey] ?? '')
                                    : '';
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={cn(
                                            statusKey && statusVal && 'border-l-2',
                                            statusKey && statusVal && statusBorderColor(statusVal),
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="whitespace-nowrap">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </BackgroundImageTexture>

            {onPageChange && (
                <div className="flex items-center justify-between px-2 py-3">
                    <p className="text-sm text-muted-foreground">
                        {totalItems != null
                            ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalItems)} of ${totalItems.toLocaleString()}`
                            : `Page ${pageIndex + 1}`}
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pageIndex - 1)}
                            disabled={pageIndex === 0}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(pageIndex + 1)}
                            disabled={totalPages != null && pageIndex + 1 >= totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function DataTableSkeleton({ rows, cols, title }: { rows: number; cols: number; title?: string }) {
    return (
        <div>
            {title && <Skeleton className="mb-2 h-5 w-40" />}
            <div className="overflow-x-auto rounded-md border">
                <Table className="w-full min-w-[600px]">
                    <TableHeader>
                        <TableRow>
                            {Array.from({ length: cols }).map((_, i) => (
                                <TableHead key={i}>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, ri) => (
                            <TableRow key={ri}>
                                {Array.from({ length: cols }).map((_, ci) => (
                                    <TableCell key={ci}>
                                        <Skeleton className="h-4 w-24" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
