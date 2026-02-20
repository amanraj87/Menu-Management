import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({ children, className = '', ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table className={`table-ui ${className}`.trim()} {...props}>
        {children}
      </table>
    </div>
  )
}

export function Thead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props}>{children}</thead>
}

export function Tbody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props}>{children}</tbody>
}

export function Tr({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props}>{children}</tr>
}

export function Th({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props}>{children}</th>
}

export function Td({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props}>{children}</td>
}
