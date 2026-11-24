import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export interface NodeLinkProps {
  nodeId: string;
  className?: string;
  children: ReactNode;
}

/** Type-safe link to a node's detail page (/nodes/$nodeId). */
export function NodeLink({ nodeId, className, children }: NodeLinkProps) {
  return (
    <Link to="/nodes/$nodeId" params={{ nodeId }} className={className}>
      {children}
    </Link>
  );
}
