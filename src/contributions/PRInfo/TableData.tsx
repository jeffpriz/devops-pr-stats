import * as React from "react";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import { ISimpleListCell } from "azure-devops-ui/List";
import { IStatusProps, Status, Statuses, StatusSize } from "azure-devops-ui/Status";
import {
    ColumnMore,
    ColumnSelect,
    ISimpleTableCell,
    ITableColumn,
    renderSimpleCell,
    TableColumnLayout,
    TableCell,
    SimpleTableCell,
    TwoLineTableCell
} from "azure-devops-ui/Table";
import { css } from "azure-devops-ui/Util";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Ago } from "azure-devops-ui/Ago";
import { Duration } from "azure-devops-ui/Duration";
import { Tooltip } from "azure-devops-ui/TooltipEx";

import { Icon, IIconProps } from "azure-devops-ui/Icon";

export const fixedColumns = [
    {
        id: "id",
        name: "ID",
        readonly: true,
        renderCell: renderId,
        width: new ObservableValue(-6)
    },
    {     
        id: "createdBy",
        name: "Created By",
        onSize: onSize,
        readonly: true,
        renderCell: renderCreatedBy,
        width: new ObservableValue(-30),
    },
    {        
        id: "prCompleteDate",
        name: "PR Created Date / Duration to completed",
        onSize: onSize,
        readonly: true,
        renderCell: renderDateColumn,
        width: new ObservableValue(-30),
    },
    {     
        id: "sourceBranch",
        name: "Source Branch",
        onSize: onSize,
        readonly: true,
        renderCell: renderSourceBranch,
        width: new ObservableValue(-30),
    },
    {
        id: "targetBranch",
        name: "Target Branch",
        onSize: onSize,
        readonly: true,
        renderCell: renderTargetBranch,
        width: new ObservableValue(-30),
    },
    {
        id: "reviewerCount",
        name: "Reviewer Count",
        onSize: onSize,
        readonly: true,
        renderCell: renderReviewerCount,
        width: new ObservableValue(-30),
    }
];

export function renderId(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem:ITableItem
): JSX.Element {
        const { id } = tableItem;
        return(
            <TableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}               
            >                 
                <div className="fontsizeM font-size-m bolt-table-inline-link-left-padding">
                    {id}
                </div>            
        </TableCell>
        );
    
}

export function renderCreatedBy(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem:ITableItem
): JSX.Element {
        const { createdBy } = tableItem;
        return(
            <TableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}               
            >                 
                <div className="fontsizeM font-size-m bolt-table-inline-link-left-padding">
                    {createdBy}
                </div>            
        </TableCell>
        );
    
}

export function renderSourceBranch(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem:ITableItem
): JSX.Element {
        const { sourceBranch } = tableItem;
        return(
            <TableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}               
            >                 
                <div className="fontsizeM font-size-m bolt-table-inline-link-left-padding">
                    {sourceBranch}
                </div>            
        </TableCell>
        );
    
}

export function renderTargetBranch(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem:ITableItem
): JSX.Element {
        const { targetBranch } = tableItem;
        return(
            <TableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}               
            >                 
                <div className="fontsizeM font-size-m bolt-table-inline-link-left-padding">
                    {targetBranch}
                </div>            
        </TableCell>
        );
    
}


export function renderReviewerCount(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem:ITableItem
): JSX.Element {
        const { reviewerCount } = tableItem;
        return(
            <TableCell
                className="bolt-table-cell-content-with-inline-link no-v-padding"
                key={"col-" + columnIndex}
                columnIndex={columnIndex}
                tableColumn={tableColumn}               
            >                 
                <div className="fontsizeM font-size-m bolt-table-inline-link-left-padding">
                    {reviewerCount}
                </div>            
        </TableCell>
        );
    
}

export function renderDateColumn(
    rowIndex: number,
    columnIndex: number,
    tableColumn: ITableColumn<ITableItem>,
    tableItem: ITableItem
): JSX.Element {
    return (
        <TwoLineTableCell
            key={"col-" + columnIndex}
            columnIndex={columnIndex}
            tableColumn={tableColumn}
            line1={WithIcon({
                className: "fontSize font-size",
                iconProps: { iconName: "Calendar" },
                children: (
                    <Ago date={tableItem.prCreatedDate!} /*format={AgoFormat.Extended}*/ />
                )
            })}
            line2={WithIcon({
                className: "fontSize font-size bolt-table-two-line-cell-item",
                iconProps: { iconName: "Clock" },
                children: (
                    <Duration
                        startDate={tableItem.prCreatedDate!}
                        endDate={tableItem.prCompleteDate}
                    />
                )
            })}
        />
    );
}
export function WithIcon(props: {
    className?: string;
    iconProps: IIconProps;
    children?: React.ReactNode;
}) {
    return (
        <div className={css(props.className, "flex-row flex-center")}>
            {Icon({ ...props.iconProps, className: "icon-margin" })}
            {props.children}
        </div>
    );
}

export function onSize(event: MouseEvent, index: number, width: number) {
    (fixedColumns[index].width as ObservableValue<number>).value = width;
}

export interface ITableItem {
    id: string;
    prCompleteDate?: Date;
    prCreatedDate?: Date;
    prOpenTime:number;
    status: string;
    createdBy: string;
    sourceBranch: string;
    targetBranch: string;
    reviewerCount:number;
}

export const renderStatus = (className?: string) => {
    return (
        <Status
            {...Statuses.Success}
            ariaLabel="Success"
            className={css(className, "bolt-table-status-icon")}
            size={StatusSize.s}
        />
    );
};





