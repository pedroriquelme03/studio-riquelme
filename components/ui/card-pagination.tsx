import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

export type CardPaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

function buildPageItems(page: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (let p = page - 1; p <= page + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }

  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push('ellipsis');
    items.push(sorted[i]);
  }
  return items;
}

export default function CardPagination({
  page,
  totalPages,
  onPageChange,
  className,
}: CardPaginationProps) {
  if (totalPages <= 1) return null;

  const items = buildPageItems(page, totalPages);
  const go = (next: number) => onPageChange(Math.min(Math.max(1, next), totalPages));

  return (
    <Card className={`p-2 ${className || ''}`.trim()}>
      <CardContent className="p-0">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationLink
                size="icon"
                aria-label="Página anterior"
                className="hover:bg-surface-muted h-8 w-8 rounded-full"
                disabled={page <= 1}
                onClick={() => go(page - 1)}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>

            {items.map((item, idx) =>
              item === 'ellipsis' ? (
                <PaginationItem key={`ellipsis-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === page}
                    aria-label={`Ir para página ${item}`}
                    className={
                      item === page
                        ? 'bg-gold text-black hover:brightness-105'
                        : 'hover:bg-surface-muted'
                    }
                    onClick={() => go(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationLink
                size="icon"
                aria-label="Próxima página"
                className="hover:bg-surface-muted h-8 w-8 rounded-full"
                disabled={page >= totalPages}
                onClick={() => go(page + 1)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardContent>
    </Card>
  );
}
